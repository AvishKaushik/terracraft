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

// ── Terrain height helper (mirrors client terrain.ts) ─────────────────────────
function tHash2(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 982451653) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function tSmooth(t) { return t * t * (3 - 2 * t); }
function tValueNoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = tSmooth(fx), v = tSmooth(fz);
  return (
    tHash2(ix,   iz,   seed) * (1-u)*(1-v) +
    tHash2(ix+1, iz,   seed) * u*(1-v) +
    tHash2(ix,   iz+1, seed) * (1-u)*v +
    tHash2(ix+1, iz+1, seed) * u*v
  );
}
function tFbm(x, z, seed) {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < 4; i++) {
    total += tValueNoise(x * freq, z * freq, seed + i * 17) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return total / max;
}
function getSurfaceY(wx, wz) {
  const b = tFbm(wx * 0.045, wz * 0.045, 7);
  const d = tFbm(wx * 0.12,  wz * 0.12,  106) * 0.3;
  return Math.floor(8 + b * 16 + d * 4);
}

// ── Day/night cycle (mirrors client SceneSetup) ────────────────────────────────
const DAY_CYCLE_SRV = 300; // seconds, same as client
let   gameElapsed   = 150; // start at midday (t=0.5)

// ── Weather state ──────────────────────────────────────────────────────────────
let weatherType  = 'clear';
let weatherTimer = 90; // seconds until first weather change

function serverDayFactor(elapsed) {
  const t = elapsed / DAY_CYCLE_SRV;
  if (t < 0.17) return 0;
  if (t < 0.30) return (t - 0.17) / 0.13;
  if (t < 0.70) return 1;
  if (t < 0.83) return 1 - (t - 0.70) / 0.13;
  return 0;
}

// ── Mob definitions ────────────────────────────────────────────────────────────
const SEA_LEVEL_SRV = 12;
const WORLD_W_SRV   = 256;
const WORLD_D_SRV   = 256;

const MOB_DEFS_SRV = {
  cow:      { maxHealth: 10, speed: 1.5, hostile: false, width: 0.9, height: 1.4 },
  zombie:   { maxHealth: 20, speed: 3.2, hostile: true,  width: 0.6, height: 1.8 },
  skeleton: { maxHealth: 20, speed: 2.8, hostile: true,  width: 0.6, height: 1.8 },
  creeper:  { maxHealth: 20, speed: 3.0, hostile: true,  width: 0.6, height: 1.7 },
  spider:   { maxHealth: 16, speed: 3.5, hostile: true,  width: 1.0, height: 0.7 },
  slime:    { maxHealth: 8,  speed: 2.0, hostile: true,  width: 0.8, height: 0.8 },
};

let nextMobId   = 0;
let nextArrowId = 0;
let nextDropId  = 0;
// code → Map<id, mob>
const serverMobs = new Map();
// global Map<id, { cluster, timer, code }>
const droppedItems = new Map();
// code → Map<"x,y,z", { x, y, z, timer }> — wheat growth timers
const cropTimers = new Map();
// socketId → partyId (string)
const partyMembers = new Map();
// partyId → Set<socketId>
const parties = new Map();
let nextPartyId = 0;

function makeMob(type, wx, wz) {
  const sy  = getSurfaceY(wx, wz);
  const def = MOB_DEFS_SRV[type];
  return {
    id:            String(++nextMobId),
    type,
    pos:           [wx + 0.5, sy + 1, wz + 0.5],
    yaw:           Math.random() * Math.PI * 2,
    health:        def.maxHealth,
    maxHealth:     def.maxHealth,
    attackCooldown: 0,
    wanderTimer:   0,
    wanderDx:      0,
    wanderDz:      0,
    burnAccum:     0,
    lastHitBy:     null,
    fuseActive:    false,
    fuseTimer:     1.5,
    breedCooldown: 0,
    breedReady:    false,
    size:          1, // for slime splitting
  };
}

function spawnMobs(code) {
  const mobs = new Map();
  const rnd = () => Math.floor(Math.random() * (WORLD_W_SRV - 8)) + 4;

  // 8 cows on land
  for (let i = 0; i < 8; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rnd(), z = rnd();
      if (getSurfaceY(x, z) > SEA_LEVEL_SRV + 1) {
        const m = makeMob('cow', x, z);
        mobs.set(m.id, m);
        break;
      }
    }
  }

  // 5 zombies at mid-depth elevations
  for (let i = 0; i < 5; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rnd(), z = rnd();
      const sy = getSurfaceY(x, z);
      if (sy > SEA_LEVEL_SRV && sy < 17) {
        const m = makeMob('zombie', x, z);
        mobs.set(m.id, m);
        break;
      }
    }
  }

  // 4 skeletons in similar terrain
  for (let i = 0; i < 4; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rnd(), z = rnd();
      const sy = getSurfaceY(x, z);
      if (sy > SEA_LEVEL_SRV && sy < 20) {
        const m = makeMob('skeleton', x, z);
        mobs.set(m.id, m);
        break;
      }
    }
  }

  // 3 spiders (surface hostile)
  for (let i = 0; i < 3; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rnd(), z = rnd();
      const sy = getSurfaceY(x, z);
      if (sy > SEA_LEVEL_SRV && sy < 22) {
        const m = makeMob('spider', x, z);
        mobs.set(m.id, m);
        break;
      }
    }
  }

  // 2 slimes (lower elevation)
  for (let i = 0; i < 2; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rnd(), z = rnd();
      const sy = getSurfaceY(x, z);
      if (sy > SEA_LEVEL_SRV && sy < 15) {
        const m = makeMob('slime', x, z);
        mobs.set(m.id, m);
        break;
      }
    }
  }

  // 3 creepers
  for (let i = 0; i < 3; i++) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = rnd(), z = rnd();
      const sy = getSurfaceY(x, z);
      if (sy > SEA_LEVEL_SRV && sy < 20) {
        const m = makeMob('creeper', x, z);
        mobs.set(m.id, m);
        break;
      }
    }
  }

  serverMobs.set(code, mobs);
  return mobs;
}

// ── Mob simulation tick (10 Hz) ────────────────────────────────────────────────
const MOB_DT = 0.1;

function tickMobs(code, state, mobs) {
  const players = [...state.players.values()];
  if (players.length === 0) return;

  const moved = [];
  const isDaytime = serverDayFactor(gameElapsed) > 0.3;

  for (const mob of mobs.values()) {
    // Zombies burn in sunlight
    if (mob.type === 'zombie' && isDaytime) {
      mob.burnAccum += MOB_DT;
      if (mob.burnAccum >= 1) {
        mob.burnAccum -= 1;
        mob.health -= 1;
        if (mob.health <= 0) {
          mobs.delete(mob.id);
          io.to(`sv:${code}`).emit('mob:died', { id: mob.id, killerId: null });
          continue;
        }
        io.to(`sv:${code}`).emit('mob:damaged', { id: mob.id, health: mob.health });
      }
    } else {
      mob.burnAccum = 0;
    }

    const def = MOB_DEFS_SRV[mob.type];
    mob.attackCooldown = Math.max(0, mob.attackCooldown - MOB_DT);

    let dx = 0, dz = 0;

    if (def.hostile) {
      // Find nearest player by XZ distance
      let nearest = null, nearestD2 = Infinity;
      for (const p of players) {
        const d2 = (p.pos[0] - mob.pos[0]) ** 2 + (p.pos[2] - mob.pos[2]) ** 2;
        if (d2 < nearestD2) { nearest = p; nearestD2 = d2; }
      }

      // Y-distance between player feet and mob top — skip if player is too far above/below
      const nearestDY = nearest ? Math.abs(nearest.pos[1] - (mob.pos[1] + def.height)) : Infinity;

      if (nearest && nearestD2 < 20 * 20) {
        const ddx = nearest.pos[0] - mob.pos[0];
        const ddz = nearest.pos[2] - mob.pos[2];
        const len = Math.sqrt(ddx * ddx + ddz * ddz) || 1;
        mob.yaw = Math.atan2(-ddx / len, -ddz / len); // face the player

        if (mob.type === 'skeleton') {
          if (nearestD2 < 4 * 4) {
            // Too close — back away
            dx = -(ddx / len) * 0.8;
            dz = -(ddz / len) * 0.8;
          } else {
            // Stand and shoot
            dx = 0; dz = 0;
            if (mob.attackCooldown <= 0) {
              mob.attackCooldown = 2.5;
              const dist = Math.sqrt(nearestD2);
              const travelTime = Math.max(0.3, dist / 15);
              const arrowId = `a${++nextArrowId}`;
              io.to(`sv:${code}`).emit('arrow:fired', {
                id: arrowId,
                from: mob.pos.slice(),
                to: [nearest.pos[0], nearest.pos[1] + 0.9, nearest.pos[2]],
                duration: travelTime,
              });
              const targetPlayer = nearest;
              setTimeout(() => {
                const st = serverStates.get(code);
                if (!st) return;
                for (const [sid, p] of st.players) {
                  if (p === targetPlayer) {
                    io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: 2 });
                    break;
                  }
                }
              }, travelTime * 1000);
            }
          }
        } else if (mob.type === 'creeper') {
          if (nearestD2 < 3 * 3) {
            // In fuse range — stop and countdown
            dx = 0; dz = 0;
            if (!mob.fuseActive) {
              mob.fuseActive = true;
              mob.fuseTimer  = 1.5;
              io.to(`sv:${code}`).emit('mob:fuse', { id: mob.id, fusing: true });
            } else {
              mob.fuseTimer -= MOB_DT;
              if (mob.fuseTimer <= 0) {
                // EXPLODE
                mobs.delete(mob.id);
                io.to(`sv:${code}`).emit('mob:died', { id: mob.id, killerId: null });
                io.to(`sv:${code}`).emit('mob:fuse', { id: mob.id, fusing: false });
                // Clear blocks in radius 2 sphere
                const [cx, cy, cz] = mob.pos.map(Math.floor);
                const R = 2;
                for (let bx = cx - R; bx <= cx + R; bx++) {
                  for (let by = cy - R; by <= cy + R; by++) {
                    for (let bz = cz - R; bz <= cz + R; bz++) {
                      if ((bx-cx)**2+(by-cy)**2+(bz-cz)**2 > R*R) continue;
                      if (bx < 0 || bx >= WORLD_W_SRV || by < 1 || bz < 0 || bz >= WORLD_D_SRV) continue;
                      const st2 = serverStates.get(code);
                      if (st2) st2.changeMap.set(`${bx},${by},${bz}`, { x: bx, y: by, z: bz, id: 0 });
                      io.to(`sv:${code}`).emit('block:set', { x: bx, y: by, z: bz, id: 0 });
                    }
                  }
                }
                // Damage players in radius 5
                for (const [sid, p] of state.players) {
                  const pd2 = (p.pos[0]-mob.pos[0])**2+(p.pos[1]-mob.pos[1])**2+(p.pos[2]-mob.pos[2])**2;
                  if (pd2 < 5 * 5) {
                    const dmg = Math.round(7 * (1 - Math.sqrt(pd2) / 5));
                    io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: Math.max(1, dmg) });
                  }
                }
                continue;
              }
            }
          } else if (nearestD2 < 4 * 4) {
            // Cancel fuse if player stepped back
            if (mob.fuseActive) {
              mob.fuseActive = false;
              mob.fuseTimer  = 1.5;
              io.to(`sv:${code}`).emit('mob:fuse', { id: mob.id, fusing: false });
            }
            dx = 0; dz = 0;
          } else {
            // Approach
            if (mob.fuseActive) {
              mob.fuseActive = false;
              mob.fuseTimer  = 1.5;
              io.to(`sv:${code}`).emit('mob:fuse', { id: mob.id, fusing: false });
            }
            dx = ddx / len;
            dz = ddz / len;
          }
        } else if (mob.type === 'spider') {
          // Spider: only hostile at night, charge and melee
          if (!isDaytime) {
            dx = ddx / len; dz = ddz / len;
            if (nearestD2 < 2 ** 2 && nearestDY < 1.5 && mob.attackCooldown <= 0) {
              mob.attackCooldown = 1.2;
              for (const [sid, p] of state.players) {
                if (p === nearest) { io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: 1 }); break; }
              }
            }
          } else { dx = 0; dz = 0; } // idle in daytime
        } else if (mob.type === 'slime') {
          // Slime: hop towards player and melee
          dx = ddx / len; dz = ddz / len;
          if (nearestD2 < 1.5 ** 2 && nearestDY < 1.5 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 2.0;
            for (const [sid, p] of state.players) {
              if (p === nearest) { io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: 2 }); break; }
            }
          }
        } else {
          // Zombie: charge and melee
          dx = ddx / len;
          dz = ddz / len;
          if (nearestD2 < 2.5 ** 2 && nearestDY < 2.5 && mob.attackCooldown <= 0) {
            mob.attackCooldown = 1.5;
            for (const [sid, p] of state.players) {
              if (p === nearest) {
                io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: 1 });
                break;
              }
            }
          }
        }
      } else {
        // Wander — cancel creeper fuse if wandering away from player
        if (mob.type === 'creeper' && mob.fuseActive) {
          mob.fuseActive = false;
          mob.fuseTimer  = 1.5;
          io.to(`sv:${code}`).emit('mob:fuse', { id: mob.id, fusing: false });
        }
        mob.wanderTimer -= MOB_DT;
        if (mob.wanderTimer <= 0) {
          const angle    = Math.random() * Math.PI * 2;
          mob.wanderDx   = Math.sin(angle);
          mob.wanderDz   = Math.cos(angle);
          mob.wanderTimer = 2 + Math.random() * 4;
          mob.yaw         = Math.atan2(-mob.wanderDx, -mob.wanderDz);
        }
        dx = mob.wanderDx;
        dz = mob.wanderDz;
      }
    } else {
      // Passive wander
      mob.wanderTimer -= MOB_DT;
      if (mob.wanderTimer <= 0) {
        const moving    = Math.random() > 0.3;
        const angle     = Math.random() * Math.PI * 2;
        mob.wanderDx    = moving ? Math.sin(angle) * 0.7 : 0;
        mob.wanderDz    = moving ? Math.cos(angle) * 0.7 : 0;
        mob.wanderTimer = 2 + Math.random() * 5;
        if (moving) mob.yaw = Math.atan2(-mob.wanderDx, -mob.wanderDz);
      }
      dx = mob.wanderDx;
      dz = mob.wanderDz;
    }

    // Apply movement, clamp to world bounds, snap Y to surface
    const nx = Math.max(1, Math.min(WORLD_W_SRV - 1, mob.pos[0] + dx * def.speed * MOB_DT));
    const nz = Math.max(1, Math.min(WORLD_D_SRV - 1, mob.pos[2] + dz * def.speed * MOB_DT));
    const sy = getSurfaceY(Math.floor(nx), Math.floor(nz));
    mob.pos = [nx, sy + 1, nz];

    moved.push({ id: mob.id, pos: mob.pos, yaw: mob.yaw });
  }

  if (moved.length > 0) {
    io.to(`sv:${code}`).emit('mobs:moved', moved);
  }
}

// ── Per-server runtime state (world changes cached in memory after first load) ─
// code → { changeMap: Map<"x,y,z", change>, players: Map<socketId, player> }
const serverStates = new Map();

async function getServerState(code) {
  if (!serverStates.has(code)) {
    const doc = await db.collection('worlds').findOne({ code });
    const changeMap = new Map();
    for (const c of (doc?.changes ?? [])) {
      changeMap.set(`${c.x},${c.y},${c.z}`, c);
    }
    serverStates.set(code, { changeMap, players: new Map() });
    spawnMobs(code); // fresh mob set for this server session
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

    socket.emit('time:sync',      { elapsed: gameElapsed });
    socket.emit('weather:change', { type: weatherType });
    socket.emit('world:changes', [...state.changeMap.values()]);
    socket.emit('players:snapshot', [...state.players.values()]);
    const mobs = serverMobs.get(serverCode) ?? new Map();
    socket.emit('mobs:snapshot', [...mobs.values()]);

    // Load saved inventory for this player on this server
    const savedInv = await db.collection('inventories').findOne({ userId: String(user._id), serverCode });
    socket.emit('inventory:load', { slots: savedInv ? savedInv.slots : [] });

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

  socket.on('inventory:save', async ({ slots }) => {
    if (!currentUser || !currentCode) return;
    await db.collection('inventories').updateOne(
      { userId: String(currentUser._id), serverCode: currentCode },
      { $set: { slots } },
      { upsert: true }
    );
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
    // Track wheat for growth
    if (id === 41) { // Wheat seedling
      if (!cropTimers.has(currentCode)) cropTimers.set(currentCode, new Map());
      cropTimers.get(currentCode).set(`${x},${y},${z}`, { x, y, z, timer: 60 }); // 60s to grow
    } else if (id === 0 || id === 40) {
      cropTimers.get(currentCode)?.delete(`${x},${y},${z}`);
    }
  });

  socket.on('mob:hit', ({ id, damage = 1 }) => {
    if (!currentCode) return;
    const mobs = serverMobs.get(currentCode);
    if (!mobs) return;
    const mob = mobs.get(String(id));
    if (!mob) return;
    mob.lastHitBy = socket.id;
    mob.health -= Math.max(1, Math.min(20, damage));
    if (mob.health <= 0) {
      mobs.delete(mob.id);
      io.to(`sv:${currentCode}`).emit('mob:died', { id: mob.id, killerId: socket.id });
      // XP reward
      const xpTable = { cow: 15, zombie: 20, skeleton: 25, creeper: 30, spider: 20, slime: 10 };
      const xpAmt = xpTable[mob.type] ?? 10;
      io.sockets.sockets.get(socket.id)?.emit('xp:gained', { amount: xpAmt });
      // Slime splitting
      if (mob.type === 'slime' && (mob.size ?? 1) > 0) {
        for (let s = 0; s < 2; s++) {
          const child = makeMob('slime', Math.floor(mob.pos[0]) + s, Math.floor(mob.pos[2]));
          child.size = (mob.size ?? 1) - 1;
          child.maxHealth = 4; child.health = 4;
          mobs.set(child.id, child);
          io.to(`sv:${currentCode}`).emit('mobs:snapshot', [...mobs.values()]);
        }
      }
    } else {
      io.to(`sv:${currentCode}`).emit('mob:damaged', { id: mob.id, health: mob.health });
    }
  });

  socket.on('player:hit', ({ targetId, damage }) => {
    if (!currentCode) return;
    // No friendly fire within same party
    const myParty = partyMembers.get(socket.id);
    const theirParty = partyMembers.get(targetId);
    if (myParty && theirParty && myParty === theirParty) return;
    const finalDmg = Math.max(1, Math.min(10, damage || 1));
    io.sockets.sockets.get(targetId)?.emit('player:damaged', { amount: finalDmg, attackerId: socket.id });
  });

  socket.on('bow:fire', ({ from, yaw, pitch, charge }) => {
    if (!currentCode) return;
    const power = Math.min(1, Math.max(0, (charge - 0.3) / 1.2));
    const range = 5 + power * 20;
    const dirX = -Math.sin(yaw) * Math.cos(pitch);
    const dirY =  Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);
    const to = [
      from[0] + dirX * range,
      from[1] + dirY * range,
      from[2] + dirZ * range,
    ];
    const travelTime = Math.max(0.2, range / 30);
    const arrowId = `a${++nextArrowId}`;
    io.to(`sv:${currentCode}`).emit('arrow:fired', { id: arrowId, from, to, duration: travelTime });

    const code = currentCode;
    setTimeout(() => {
      const st = serverStates.get(code);
      if (!st) return;
      // Check mob hits
      const mobs = serverMobs.get(code);
      if (mobs) {
        for (const [, mob] of mobs) {
          const md2 = (mob.pos[0]-to[0])**2+(mob.pos[2]-to[2])**2;
          if (md2 < 1.5*1.5) {
            const dmg = Math.round(3 + power * 6);
            mob.lastHitBy = socket.id;
            mob.health -= dmg;
            if (mob.health <= 0) {
              mobs.delete(mob.id);
              io.to(`sv:${code}`).emit('mob:died', { id: mob.id, killerId: socket.id });
            } else {
              io.to(`sv:${code}`).emit('mob:damaged', { id: mob.id, health: mob.health });
            }
            break;
          }
        }
      }
      // Check player hits
      for (const [sid, p] of st.players) {
        if (sid === socket.id) continue;
        const pd2 = (p.pos[0]-to[0])**2+(p.pos[2]-to[2])**2;
        if (pd2 < 1*1) {
          const dmg = Math.round(3 + power * 6);
          io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: dmg, attackerId: socket.id });
          break;
        }
      }
    }, travelTime * 1000);
  });

  socket.on('player:died', ({ killerId, items }) => {
    if (!currentCode) return;
    if (!Array.isArray(items) || items.length === 0) return;
    const state = serverStates.get(currentCode);
    const deadPlayer = state?.players.get(socket.id);
    if (!deadPlayer) return;

    const dropId = ++nextDropId;
    const cluster = {
      id:    dropId,
      pos:   deadPlayer.pos.slice(),
      items: items.slice(0, 20),
    };
    droppedItems.set(dropId, { cluster, timer: 60, code: currentCode });
    io.to(`sv:${currentCode}`).emit('items:dropped', cluster);

    // Kill feed for PvP
    if (killerId) {
      const killerPlayer = state?.players.get(killerId);
      const killerName = killerPlayer?.name ?? 'Unknown';
      io.to(`sv:${currentCode}`).emit('killfeed:pvp', {
        killerName,
        victimName: deadPlayer.name,
      });
    }
  });

  socket.on('tnt:ignite', ({ x, y, z }) => {
    if (!currentCode) return;
    const code = currentCode;
    // Remove TNT block immediately and broadcast
    const st = serverStates.get(code);
    if (st) st.changeMap.set(`${x},${y},${z}`, { x, y, z, id: 0 });
    io.to(`sv:${code}`).emit('block:set', { x, y, z, id: 0 });
    // Explode after 4 seconds
    setTimeout(() => {
      const R = 3;
      const changes = [];
      for (let bx = x - R; bx <= x + R; bx++) {
        for (let by = y - R; by <= y + R; by++) {
          for (let bz = z - R; bz <= z + R; bz++) {
            if ((bx-x)**2+(by-y)**2+(bz-z)**2 > R*R) continue;
            if (bx < 0 || bx >= WORLD_W_SRV || by < 1 || bz < 0 || bz >= WORLD_D_SRV) continue;
            const st2 = serverStates.get(code);
            if (st2) st2.changeMap.set(`${bx},${by},${bz}`, { x: bx, y: by, z: bz, id: 0 });
            changes.push({ x: bx, y: by, z: bz, id: 0 });
          }
        }
      }
      io.to(`sv:${code}`).emit('tnt:explode', { x, y, z, changes });
      // Damage players in radius 6
      const st3 = serverStates.get(code);
      if (st3) {
        for (const [sid, p] of st3.players) {
          const pd2 = (p.pos[0]-x)**2+(p.pos[1]-y)**2+(p.pos[2]-z)**2;
          if (pd2 < 6 * 6) {
            const dmg = Math.round(8 * (1 - Math.sqrt(pd2) / 6));
            io.sockets.sockets.get(sid)?.emit('player:damaged', { amount: Math.max(1, dmg) });
          }
        }
      }
    }, 4000);
  });

  socket.on('mob:breed', ({ id }) => {
    if (!currentCode) return;
    const mobs = serverMobs.get(currentCode);
    if (!mobs) return;
    const mob = mobs.get(String(id));
    if (!mob || mob.type !== 'cow' || mob.breedCooldown > 0 || mob.breedReady) return;
    mob.breedReady = true;
    // Find another ready cow nearby
    for (const [, other] of mobs) {
      if (other.id === mob.id || other.type !== 'cow' || !other.breedReady) continue;
      const d2 = (mob.pos[0]-other.pos[0])**2+(mob.pos[2]-other.pos[2])**2;
      if (d2 < 3*3) {
        mob.breedReady = false; other.breedReady = false;
        mob.breedCooldown = 300; other.breedCooldown = 300;
        const child = makeMob('cow', Math.floor(mob.pos[0]), Math.floor(mob.pos[2]));
        child.maxHealth = 5; child.health = 5;
        mobs.set(child.id, child);
        io.to(`sv:${currentCode}`).emit('mobs:snapshot', [...mobs.values()]);
        break;
      }
    }
  });

  socket.on('items:pickup', ({ id }) => {
    if (!currentCode) return;
    const entry = droppedItems.get(id);
    if (!entry || entry.code !== currentCode) return;
    droppedItems.delete(id);
    io.to(`sv:${currentCode}`).emit('items:removed', { id });
    socket.emit('items:give', entry.cluster.items);
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

      if (cmd === 'party') {
        const sub = parts[1]?.toLowerCase();
        if (sub === 'create') {
          const pid = String(++nextPartyId);
          parties.set(pid, new Set([socket.id]));
          partyMembers.set(socket.id, pid);
          return sysMsg(`Created party #${pid}. Share with others: /party join ${pid}`);
        }
        if (sub === 'join') {
          const pid = parts[2];
          if (!pid || !parties.has(pid)) return sysMsg(`Party "${pid}" not found.`);
          // Leave old party
          const oldPid = partyMembers.get(socket.id);
          if (oldPid && parties.has(oldPid)) parties.get(oldPid).delete(socket.id);
          parties.get(pid).add(socket.id);
          partyMembers.set(socket.id, pid);
          return sysMsg(`Joined party #${pid}.`);
        }
        if (sub === 'leave') {
          const pid = partyMembers.get(socket.id);
          if (!pid) return sysMsg('You are not in a party.');
          parties.get(pid)?.delete(socket.id);
          partyMembers.delete(socket.id);
          return sysMsg('Left party.');
        }
        return sysMsg('Usage: /party create | /party join <id> | /party leave');
      }

      return sysMsg(`Unknown command "/${cmd}". Available: /kick, /tp, /give, /party`);
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

// ── Mob tick loop (10 Hz) ──────────────────────────────────────────────────────
let timeSyncAccum = 0;
setInterval(() => {
  gameElapsed = (gameElapsed + MOB_DT) % DAY_CYCLE_SRV;
  timeSyncAccum += MOB_DT;
  if (timeSyncAccum >= 30) {
    timeSyncAccum = 0;
    io.emit('time:sync', { elapsed: gameElapsed });
  }

  weatherTimer -= MOB_DT;
  if (weatherTimer <= 0) {
    if (weatherType === 'clear') {
      weatherType   = Math.random() < 0.28 ? 'thunder' : 'rain';
      weatherTimer  = 30 + Math.random() * 60;
    } else {
      weatherType   = 'clear';
      weatherTimer  = 70 + Math.random() * 110;
    }
    io.emit('weather:change', { type: weatherType });
  }

  for (const [code, state] of serverStates) {
    if (state.players.size === 0) continue;
    const mobs = serverMobs.get(code);
    if (mobs && mobs.size > 0) tickMobs(code, state, mobs);
  }

  // Crop growth (60s → ripe)
  for (const [code, crops] of cropTimers) {
    for (const [key, crop] of crops) {
      crop.timer -= MOB_DT;
      if (crop.timer <= 0) {
        crops.delete(key);
        // Grow seedling (41) → ripe wheat (42)
        const change = { x: crop.x, y: crop.y, z: crop.z, id: 42 };
        const st = serverStates.get(code);
        if (st) st.changeMap.set(key, change);
        io.to(`sv:${code}`).emit('block:set', { x: crop.x, y: crop.y, z: crop.z, id: 42 });
      }
    }
  }

  // Breed cooldown tick
  for (const [, mobs] of serverMobs) {
    for (const mob of mobs.values()) {
      if (mob.breedCooldown > 0) mob.breedCooldown -= MOB_DT;
    }
  }

  // Drop despawn (60s)
  for (const [id, entry] of droppedItems) {
    entry.timer -= MOB_DT;
    if (entry.timer <= 0) {
      droppedItems.delete(id);
      io.to(`sv:${entry.code}`).emit('items:removed', { id });
    }
  }
}, 100);

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => httpServer.listen(PORT, () => console.log(`TerraCraft on :${PORT}`)))
  .catch(err => { console.error('DB connection failed:', err); process.exit(1); });
