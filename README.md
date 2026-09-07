# Broadcast Server

A real-time message broadcasting platform. A React client connects over
WebSockets and instantly receives every message sent by other connected
clients.

## Project structure

- `server/` — Node.js WebSocket server (per-room routing, JWT sessions, MongoDB
  message history, CLI)
- `client/` — React chat interface (join rooms, send and receive messages live)

## Getting started

```bash
npm install
npm run dev        # start the WebSocket server
npm run dev:client # start the React dev server
```

## Planned features

- WebSocket broadcast with per-room (channel) routing
- `broadcast-server` CLI: `start` and `connect` commands
- JWT-authenticated client sessions
- MongoDB message history so late joiners catch up on what they missed
- Graceful shutdown that cleans up connections properly
