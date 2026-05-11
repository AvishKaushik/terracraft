'use strict';
require('dotenv').config(); // loads .env into process.env
const http     = require('http');
const express  = require('express');
const { Server } = require('socket.io');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const path     = require('path');
const { MongoClient } = require('mongodb');

// ── DB connection ──────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/terracraft';

let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();

  // Unique indexes — safe to call repeatedly (no-op if they already exist)
  await db.collection('users').createIndex(
    { username: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 } },
  );
  await db.collection('servers').createIndex({ code: 1 }, { unique: true });
  await db.collection('worlds').createIndex({ code: 1 }, { unique: true });

  console.log('MongoDB connected');
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const CI = { collation: { locale: 'en', strength: 2 } }; // case-insensitive

function generateToken() { return crypto.randomBytes(32).toString('hex'); }

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * 26)]).join('');
}

function publicUser(u) {
  return {
    id:         u._id.toString(),
    username:   u.username,
    skinColor:  u.skinColor,
    shirtColor: u.shirtColor,
    pantsColor: u.pantsColor,
  };
}

function authHeader(req) {
  return req.headers.authorization?.replace('Bearer ', '') ?? null;
}

// ── Session tokens (in-memory; users re-login on server restart) ───────────────
const sessions = new Map(); // token → userId string

async function getUserByToken(token) {
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  const { ObjectId } = require('mongodb');
  return db.collection('users').findOne({ _id: new ObjectId(userId) });
}

// ── Per-server runtime state (world changes cached in memory after first load) ─
// code → { changeMap: Map<"x,y,z", change>, players: Map<socketId, player> }
const serverStates = new Map();

async function getServerState(code) {
  if (!serverStates.has(code)) {
    const doc = await db.collection('worlds').findOne({ code });
    // Rebuild a deduped map from the stored array (last write wins per position)
    const changeMap = new Map();
    for (const c of (doc?.changes ?? [])) {
      changeMap.set(`${c.x},${c.y},${c.z}`, c);
    }
    serverStates.set(code, { changeMap, players: new Map() });
  }
  return serverStates.get(code);
}

async function upsertBlockChange(code, change) {
  const key = `${change.x},${change.y},${change.z}`;

  // Update in-memory map (deduped by position)
  const state = serverStates.get(code);
  if (state) state.changeMap.set(key, change);

  // Persist: pull old entry for this position, then push new one
  await db.collection('worlds').updateOne(
    { code },
    { $pull: { changes: { x: change.x, y: change.y, z: change.z } } },
  );
  await db.collection('worlds').updateOne(
    { code },
    { $push: { changes: change } },
    { upsert: true },
  );
}

// ── Express app ────────────────────────────────────────────────────────────────
const app    = express();
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json());
if (IS_PROD) app.use(express.static(path.join(__dirname, 'dist')));

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: 'Username must be 3–20 characters' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Username: letters, numbers and _ only' });

  const existing = await db.collection('users').findOne({ username }, CI);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const doc = {
    username,
    passwordHash,
    skinColor:  '#f4c07a',
    shirtColor: '#3a5fa0',
    pantsColor: '#1e3a5f',
    createdAt:  Date.now(),
  };
  const result = await db.collection('users').insertOne(doc);
  doc._id = result.insertedId;

  const token = generateToken();
  sessions.set(token, result.insertedId.toString());
  res.json({ token, user: publicUser(doc) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  const user = await db.collection('users').findOne({ username }, CI);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: 'Invalid username or password' });

  const token = generateToken();
  sessions.set(token, user._id.toString());
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = authHeader(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

// ── Avatar ─────────────────────────────────────────────────────────────────────
app.patch('/api/users/me/avatar', async (req, res) => {
  const user = await getUserByToken(authHeader(req));
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { skinColor, shirtColor, pantsColor } = req.body ?? {};
  const updates = {};
  if (skinColor)  updates.skinColor  = skinColor;
  if (shirtColor) updates.shirtColor = shirtColor;
  if (pantsColor) updates.pantsColor = pantsColor;

  await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
  res.json({ ...user, ...updates });
});

// ── Game servers ───────────────────────────────────────────────────────────────
app.post('/api/servers', async (req, res) => {
  const user = await getUserByToken(authHeader(req));
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const { name } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: 'Server name required' });
  if (name.trim().length > 30) return res.status(400).json({ error: 'Server name max 30 chars' });

  // Retry in the astronomically unlikely case of a code collision
  let code, inserted = false;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    code = generateCode();
    try {
      await db.collection('servers').insertOne({
        code, name: name.trim(), ownerId: user._id.toString(), createdAt: Date.now(),
      });
      inserted = true;
    } catch (e) {
      if (e.code !== 11000) throw e; // 11000 = duplicate key
    }
  }
  if (!inserted) return res.status(500).json({ error: 'Failed to generate unique code' });

  res.json({ code, name: name.trim() });
});

app.get('/api/servers', async (req, res) => {
  const user = await getUserByToken(authHeader(req));
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const servers = await db.collection('servers').find({}).sort({ createdAt: -1 }).limit(50).toArray();
  const list = servers.map(s => {
    const state = serverStates.get(s.code);
    return {
      code:        s.code,
      name:        s.name,
      playerCount: state ? state.players.size : 0,
    };
  });
  res.json(list);
});

app.get('/api/servers/:code', async (req, res) => {
  const user = await getUserByToken(authHeader(req));
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const code   = req.params.code.toUpperCase();
  const server = await db.collection('servers').findOne({ code });
  if (!server) return res.status(404).json({ error: 'Server not found' });

  res.json({ code: server.code, name: server.name });
});

// SPA fallback — must be last; app.use catches everything Express 4 & 5
if (IS_PROD) {
  app.use((_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

// ── Socket.io ──────────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', socket => {
  let currentUser = null;
  let currentCode = null;

  socket.on('player:join', async ({ token, serverCode }) => {
    const user   = await getUserByToken(token);
    const server = await db.collection('servers').findOne({ code: serverCode });
    if (!user || !server) { socket.disconnect(); return; }

    currentUser = user;
    currentCode = serverCode;

    const state = await getServerState(serverCode);

    socket.emit('world:changes', [...state.changeMap.values()]);
    socket.emit('players:snapshot', [...state.players.values()]);

    const player = {
      id:         socket.id,
      name:       user.username,
      pos:        [32, 20, 32],
      yaw:        0,
      pitch:      0,
      skinColor:  user.skinColor,
      shirtColor: user.shirtColor,
      pantsColor: user.pantsColor,
    };
    state.players.set(socket.id, player);

    socket.join(`sv:${serverCode}`);
    socket.to(`sv:${serverCode}`).emit('player:joined', player);
    console.log(`+ ${user.username} → ${serverCode}`);
  });

  socket.on('player:move', ({ pos, yaw, pitch }) => {
    if (!currentCode) return;
    const state = serverStates.get(currentCode);
    const p     = state?.players.get(socket.id);
    if (p) { p.pos = pos; p.yaw = yaw; p.pitch = pitch; }
    socket.to(`sv:${currentCode}`).emit('player:moved', { id: socket.id, pos, yaw, pitch });
  });

  socket.on('block:set', async ({ x, y, z, id, face }) => {
    if (!currentCode) return;
    const change = { x, y, z, id, ...(face ? { face } : {}) };
    await upsertBlockChange(currentCode, change);
    socket.to(`sv:${currentCode}`).emit('block:set', { x, y, z, id, face });
  });

  socket.on('chest:open', async ({ x, y, z }) => {
    if (!currentCode) return;
    const doc = await db.collection('chests').findOne({ code: currentCode, x, y, z });
    const slots = doc?.slots ?? Array(27).fill(0);
    socket.emit('chest:data', { pos: [x, y, z], slots });
  });

  socket.on('chest:set', async ({ x, y, z, idx, blockId }) => {
    if (!currentCode) return;
    if (idx < 0 || idx > 26) return;
    await db.collection('chests').updateOne(
      { code: currentCode, x, y, z },
      { $set: { [`slots.${idx}`]: blockId } },
      { upsert: true },
    );
    // Broadcast to other players who may be viewing the same chest
    socket.to(`sv:${currentCode}`).emit('chest:set', { x, y, z, idx, blockId });
  });

  socket.on('chat:message', async ({ text }) => {
    if (!currentCode || !currentUser || !text?.trim()) return;
    const msg = String(text).trim().slice(0, 200);

    // ── Admin commands ─────────────────────────────────────
    if (msg.startsWith('/')) {
      const server = await db.collection('servers').findOne({ code: currentCode });
      const isOwner = server && server.ownerId === currentUser._id.toString();

      const parts = msg.slice(1).split(/\s+/);
      const cmd   = parts[0]?.toLowerCase();

      const sysMsg = (t) => socket.emit('chat:message', { name: '§', text: t });

      if (cmd === 'kick') {
        if (!isOwner) return sysMsg('Only the server owner can kick players.');
        const target = parts[1]?.toLowerCase();
        if (!target) return sysMsg('Usage: /kick <username>');
        const state = serverStates.get(currentCode);
        let kicked = false;
        for (const [sid, p] of (state?.players ?? [])) {
          if (p.name.toLowerCase() === target) {
            io.sockets.sockets.get(sid)?.disconnect(true);
            kicked = true;
            break;
          }
        }
        return sysMsg(kicked ? `Kicked ${parts[1]}.` : `Player "${parts[1]}" not found.`);
      }

      if (cmd === 'tp') {
        const target = parts[1]?.toLowerCase();
        if (!target) return sysMsg('Usage: /tp <username>');
        const state = serverStates.get(currentCode);
        let found = false;
        for (const p of (state?.players.values() ?? [])) {
          if (p.name.toLowerCase() === target) {
            socket.emit('cmd:tp', { pos: p.pos });
            found = true;
            break;
          }
        }
        if (!found) sysMsg(`Player "${parts[1]}" not found.`);
        return;
      }

      if (cmd === 'give') {
        if (!isOwner) return sysMsg('Only the server owner can use /give.');
        const blockId = parseInt(parts[1]);
        if (isNaN(blockId) || blockId < 1 || blockId > 32)
          return sysMsg('Usage: /give <blockId 1–32>');
        socket.emit('cmd:give', { blockId });
        return;
      }

      return sysMsg(`Unknown command "/${cmd}". Available: /kick, /tp, /give`);
    }

    io.to(`sv:${currentCode}`).emit('chat:message', {
      name: currentUser.username,
      text: msg,
    });
  });

  socket.on('disconnect', () => {
    if (!currentCode || !currentUser) return;
    const state = serverStates.get(currentCode);
    if (state) state.players.delete(socket.id);
    io.to(`sv:${currentCode}`).emit('player:left', socket.id);
    console.log(`- ${currentUser.username} ← ${currentCode}`);
  });
});

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => httpServer.listen(PORT, () => console.log(`TerraCraft on :${PORT}`)))
  .catch(err => { console.error('DB connection failed:', err); process.exit(1); });
