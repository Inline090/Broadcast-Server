const { WebSocketServer, WebSocket } = require('ws');
const mongoose = require('mongoose');
const rooms = require('./rooms');
const { verifyToken } = require('./auth');
const { saveMessage, recentMessages } = require('./history');
const { createHttpServer } = require('./httpServer');
const rateLimit = require('./rateLimit');
const {
  PORT,
  MONGODB_URI,
  HEARTBEAT_INTERVAL_MS,
  MAX_PAYLOAD_BYTES,
  MAX_MESSAGE_LENGTH,
} = require('./config');

// Tell every socket in a room who is currently present.
function broadcastMembers(room) {
  const payload = JSON.stringify({
    type: 'members',
    room,
    usernames: rooms.usernames(room),
  });
  rooms.members(room).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// HTTP server handles POST /api/token; the WebSocket server attaches to it so
// both share one port.
const server = createHttpServer({ listRooms: rooms.list });
const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD_BYTES });

wss.on('connection', (socket) => {
  // A socket-level error (oversized frame, protocol violation, reset) must be
  // caught here — an unhandled 'error' event would crash the whole process.
  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });

  // Liveness for the heartbeat below.
  socket.isAlive = true;
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  // The socket stays unauthenticated until the client sends {type:'auth'}.
  // The token must never travel in the URL: URLs leak into server logs,
  // proxy logs, and browser history.
  let user = null;

  const authTimeout = setTimeout(() => {
    socket.send(
      JSON.stringify({ type: 'error', message: 'authentication timeout' }),
    );
    socket.close();
  }, 5000);

  socket.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    // Drop messages once the client exceeds its send rate.
    const limit = rateLimit.check(socket);
    if (!limit.allowed) {
      if (limit.firstWarning) {
        socket.send(
          JSON.stringify({ type: 'error', message: 'rate limit exceeded' }),
        );
      }
      return;
    }

    // The first message must authenticate the connection.
    if (!user) {
      if (msg.type !== 'auth' || typeof msg.token !== 'string') {
        socket.send(
          JSON.stringify({ type: 'error', message: 'authentication required' }),
        );
        socket.close();
        return;
      }
      try {
        user = verifyToken(msg.token);
      } catch {
        socket.send(
          JSON.stringify({ type: 'error', message: 'invalid token' }),
        );
        socket.close();
        return;
      }
      clearTimeout(authTimeout);
      socket.username = user.username;
      console.log(
        `Client authenticated: ${socket.username}. total=${wss.clients.size}`,
      );
      socket.send(
        JSON.stringify({
          type: 'welcome',
          username: socket.username,
          message: `Connected to Broadcast Server as ${socket.username}`,
        }),
      );
      return;
    }

    if (msg.type === 'join') {
      const room = typeof msg.room === 'string' ? msg.room : null;
      if (!room) {
        socket.send(
          JSON.stringify({ type: 'error', message: 'room is required' }),
        );
        return;
      }
      rooms.join(socket, room);

      // Late joiner catch-up: replay recent history for this room.
      recentMessages(room, 50)
        .then((messages) => {
          socket.send(JSON.stringify({ type: 'history', room, messages }));
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
        }),
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

      broadcastMembers(room);
      return;
    }

    // Anything else is treated as a chat message scoped to the sender's room.
    if (!socket.room) {
      socket.send(
        JSON.stringify({ type: 'error', message: 'Join a room first' }),
      );
      return;
    }

    // Validate before broadcasting or persisting.
    if (typeof msg.text !== 'string' || msg.text.trim() === '') {
      socket.send(
        JSON.stringify({ type: 'error', message: 'text is required' }),
      );
      return;
    }
    if (msg.text.length > MAX_MESSAGE_LENGTH) {
      socket.send(
        JSON.stringify({
          type: 'error',
          message: `text exceeds ${MAX_MESSAGE_LENGTH} characters`,
        }),
      );
      return;
    }

    const text = msg.text;
    const username = socket.username;
    const room = socket.room;

    // Persist before broadcasting so history is never missing a message.
    saveMessage(room, username, text).catch((err) => {
      console.error('Failed to save message:', err);
    });

    const payload = JSON.stringify({
      type: 'message',
      username,
      text,
      sentAt: new Date().toISOString(),
    });

    console.log(`[${room}] ${username}: ${text}`);

    rooms.members(room).forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  socket.on('close', () => {
    clearTimeout(authTimeout);
    const leftRoom = socket.room;
    rooms.leave(socket);
    console.log(
      `Client disconnected: ${socket.username || 'unauthenticated'}. total=${wss.clients.size}`,
    );
    if (leftRoom) {
      broadcastMembers(leftRoom);
    }
  });
});

// Terminate sockets that stop responding to pings. A half-open TCP connection
// (client lost network) never fires 'close', so without this it lingers forever.
const heartbeat = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      console.log('Terminating unresponsive client.');
      return socket.terminate();
    }
    socket.isAlive = false;
    socket.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

async function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  clearInterval(heartbeat);

  // Stop accepting new connections, then close every open client socket.
  server.close(() => {
    console.log('HTTP server closed.');
  });
  wss.close(() => {
    console.log('WebSocket server closed.');
  });
  for (const client of wss.clients) {
    client.close(1001, 'Server shutting down');
  }

  // Close the MongoDB connection before exiting.
  try {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err.message);
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
    server.listen(PORT, () => {
      console.log(`Broadcast server listening on ws://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

start();

module.exports = { shutdown };
