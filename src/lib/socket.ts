import { io } from 'socket.io-client';

// In dev Vite runs on :5173 while the game server is on :3001.
// In production both are on the same origin so we pass '' (same-origin).
const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export const socket = io(SERVER_URL, { autoConnect: false });
