const { WebSocketServer, WebSocket } = require('ws');
const mongoose = require('mongoose');
const rooms = require('./rooms');
const { verifyToken } = require('./auth');
const { saveMessage, recentMessages } = require('./history');
const { PORT, MONGODB_URI } = require('./config');

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket, request) => {
  // Identity comes from the JWT, never from what the client claims.
  const token = new URL(request.url, 'http://localhost').searchParams.get('token');
  if (!token) {
    socket.send(JSON.stringify({ type: 'error', message: 'token is required' }));
    socket.close();
    return;
  }

  let user;
  try {
    user = verifyToken(token);
  } catch {
    socket.send(JSON.stringify({ type: 'error', message: 'invalid token' }));
    socket.close();
    return;
  }

  socket.username = user.username;
  console.log(`Client connected: ${socket.username}. total=${wss.clients.size}`);

  socket.send(
    JSON.stringify({
      type: 'welcome',
      username: socket.username,
      message: `Connected to Broadcast Server as ${socket.username}`,
    })
  );

  socket.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (msg.type === 'join') {
      const room = typeof msg.room === 'string' ? msg.room : null;
      if (!room) {
        socket.send(
          JSON.stringify({ type: 'error', message: 'room is required' })
        );
        return;
      }
      rooms.join(socket, room);

      // Late joiner catch-up: replay recent history for this room.
      recentMessages(room, 50)
        .then((messages) => {
          socket.send(
            JSON.stringify({ type: 'history', room, messages })
          );
        })
        .catch((err) => {
          console.error('Failed to load history:', err);
        });

      const memberCount = rooms.members(room).size;
      socket.send(
        JSON.stringify({
          type: 'joined',
          room,
          members: memberCount,
          message: `You joined ${room}`,
        })
      );

      const payload = JSON.stringify({
        type: 'system',
        text: `${socket.username} joined ${room}`,
      });
      rooms.members(room).forEach((client) => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
      return;
    }

    // Anything else is treated as a chat message scoped to the sender's room.
    if (!socket.room) {
      socket.send(
        JSON.stringify({ type: 'error', message: 'Join a room first' })
      );
      return;
    }

    const text = msg.text || '';
    const username = socket.username;
    const room = socket.room;

    // Persist before broadcasting so history is never missing a message.
    saveMessage(room, username, text)
      .catch((err) => {
        console.error('Failed to save message:', err);
      });

    const payload = JSON.stringify({
      type: 'message',
      username,
      text,
    });

    console.log(`[${room}] ${username}: ${text}`);

    rooms.members(room).forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  socket.on('close', () => {
    rooms.leave(socket);
    console.log(`Client disconnected: ${socket.username}. total=${wss.clients.size}`);
  });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

start();
console.log(`Broadcast server listening on ws://localhost:${PORT}`);
