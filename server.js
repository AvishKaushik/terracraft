import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

const players = new Map(); // id → { id, name, pos, yaw, pitch }
const blockChanges = []; // replay log for late joiners

io.on('connection', socket => {
  // Send current state to new joiner
  socket.emit('world:changes', blockChanges);
  socket.emit('players:snapshot', [...players.values()]);

  socket.on('player:join', ({ name }) => {
    const player = { id: socket.id, name, pos: [32, 20, 32], yaw: 0, pitch: 0 };
    players.set(socket.id, player);
    socket.broadcast.emit('player:joined', player);
    console.log(`+ ${name} (${socket.id.slice(0, 6)})`);
  });

  socket.on('player:move', ({ pos, yaw, pitch }) => {
    const p = players.get(socket.id);
    if (p) { p.pos = pos; p.yaw = yaw; p.pitch = pitch; }
    socket.broadcast.emit('player:moved', { id: socket.id, pos, yaw, pitch });
  });

  socket.on('block:set', ({ x, y, z, id }) => {
    blockChanges.push({ x, y, z, id });
    socket.broadcast.emit('block:set', { x, y, z, id });
  });

  socket.on('chat:message', ({ name, text }) => {
    if (!text?.trim()) return;
    io.emit('chat:message', { name: String(name).slice(0, 20), text: String(text).trim().slice(0, 200) });
  });

  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    console.log(`- ${p?.name ?? socket.id.slice(0, 6)}`);
    players.delete(socket.id);
    io.emit('player:left', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Voxel server on :${PORT}`));
