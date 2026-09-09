const { WebSocketServer, WebSocket } = require('ws');

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

    console.log(`Received from ${msg.username ?? 'anonymous'}:`, msg.text ?? msg);

    const payload = JSON.stringify(msg);
    wss.clients.forEach((client) => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  });

  socket.on('close', () => {
    console.log(`Client disconnected. total=${wss.clients.size}`);
  });
});

console.log(`Broadcast server listening on ws://localhost:${PORT}`);
