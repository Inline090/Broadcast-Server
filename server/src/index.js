const { WebSocketServer, WebSocket } = require('ws');
const rooms = require('./rooms');

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket) => {
  console.log(`Client connected. total=${wss.clients.size}`);

  socket.send(
    JSON.stringify({
      type: 'welcome',
      message: 'Connected to Broadcast Server',
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
      socket.username = msg.username || 'anonymous';
      rooms.join(socket, room);

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

    const payload = JSON.stringify({
      type: 'message',
      username: msg.username || socket.username || 'anonymous',
      text: msg.text || '',
    });

    console.log(`[${socket.room}] ${msg.username}: ${msg.text}`);

    rooms.members(socket.room).forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  socket.on('close', () => {
    rooms.leave(socket);
    console.log(`Client disconnected. total=${wss.clients.size}`);
  });
});

console.log(`Broadcast server listening on ws://localhost:${PORT}`);
