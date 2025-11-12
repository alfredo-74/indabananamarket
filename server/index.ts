import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import routes from './routes.js';
import { io as createClient } from 'socket.io-client';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', routes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Serve UI — use __dirname from CommonJS
app.use(express.static(path.join(__dirname, '../dist/client')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '../dist/client/index.html'))
);

// Python bridge
const pythonSocket = createClient('http://localhost:8765');

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
