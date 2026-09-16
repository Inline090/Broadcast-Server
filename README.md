# Broadcast Server

A real-time message broadcasting platform. Clients connect over WebSockets and
instantly receive every message sent by others in the same room. Message history
is persisted so a client joining late catches up on what it missed.

## Features

- **WebSocket broadcast** — messages fan out to everyone in a room, never back
  to the sender
- **Rooms (channels)** — join a named room; broadcasts are scoped to it
- **Live member list** — the server pushes the current room occupancy on every
  join and leave
- **JWT authentication** — the socket stays unauthenticated until the client
  sends a valid token; identity always comes from the token, never from the
  client's claims
- **Message history** — every message is stored in MongoDB and replayed to late
  joiners
- **Heartbeat** — unresponsive (half-open) connections are terminated and
  cleaned out of their rooms
- **Rate limiting** — per-socket send limits prevent message floods
- **Graceful shutdown** — Ctrl+C closes client sockets, the HTTP server, and the
  database connection in order
- **CLI** — start the server or connect as a terminal chat client

## Tech stack

| Layer     | Choice                        | Notes                                                      |
| --------- | ----------------------------- | ---------------------------------------------------------- |
| Server    | Node.js                       | I/O-bound workload — a natural fit for WebSockets          |
| WebSocket | `ws`                          | Raw protocol, so connection tracking and fan-out are ours  |
| HTTP      | Node `http`                   | Token + rooms endpoints share a port with the WebSocket    |
| Auth      | `jsonwebtoken` (JWT)          | Stateless sessions; identity travels with each connection  |
| Storage   | MongoDB + `mongoose`          | Chat history is an append-heavy document workload          |
| Client    | React 19 + Vite               | Component state for messages, rooms, and connection status |
| Tests     | Node's built-in `node:test`   | Zero extra dependencies for pure-logic modules             |
| CI        | GitHub Actions                | Installs, tests, and builds the client on every push       |

## Architecture

```
                    ┌─────────────────────────────────────────┐
   POST /api/token  │  HTTP server (single port)              │
   GET  /api/rooms  │   ├── token endpoint (issues JWTs)      │
        ──────────► │   └── rooms endpoint (occupancy)        │
                    │                                         │
   ws://  ────────► │  WebSocketServer (attached to HTTP)     │
                    └───────────────┬─────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
          rooms.js              history.js            rateLimit.js
      (room → socket sets)   (MongoDB messages)   (per-socket limits)
```

A single HTTP server is created, and the WebSocket server is attached to it, so
REST endpoints and the socket share one port. Room membership lives in memory
(the source of truth for presence); messages are persisted to MongoDB.

### Server modules

| File            | Responsibility                                             |
| --------------- | ---------------------------------------------------------- |
| `index.js`      | Wires everything: connection lifecycle, auth, join, chat    |
| `config.js`     | Environment-driven settings with safe development defaults  |
| `auth.js`       | JWT sign / verify helpers                                   |
| `rooms.js`      | Room membership: join, leave, member usernames, listing     |
| `history.js`    | Mongoose model + save / recent-messages queries             |
| `rateLimit.js`  | Fixed-window per-socket message limiter                     |
| `httpServer.js` | HTTP routes for token issuance and room listing             |
| `cli.js`        | `broadcast-server start` and `connect` commands             |

## Getting started

Requirements: Node.js 20+ and a MongoDB instance.

```bash
# 1. Start MongoDB (or point MONGODB_URI at your own instance)
docker run -d --name broadcast-mongo -p 27017:27017 \
  -v broadcast-mongo-data:/data/db mongo:7

# 2. Install workspace dependencies
npm install

# 3. Run the server and the client (separate terminals)
npm run dev          # WebSocket + HTTP server on :8080
npm run dev:client   # React client on :5173
```

Open http://localhost:5173, pick a username and room, and start chatting. Open a
second browser tab to see live delivery and the member list update.

## CLI

```bash
# Start the server (optionally on another port)
npm run cli -- start --port 8090

# Connect as a chat client
npm run cli -- connect --host localhost --port 8080 --room lobby --username alice
```

## WebSocket protocol

All frames are JSON. The client must authenticate before doing anything else.

**Client → server**

| Message                              | Purpose                          |
| ------------------------------------ | -------------------------------- |
| `{"type":"auth","token":"<jwt>"}`    | Required first message           |
| `{"type":"join","room":"lobby"}`     | Join (or switch) a room          |
| `{"type":"message","text":"hi"}`     | Send a chat message              |

**Server → client**

| Message                                            | Purpose                                  |
| -------------------------------------------------- | ---------------------------------------- |
| `{"type":"welcome","username":"alice"}`            | Authentication accepted                  |
| `{"type":"joined","room":"lobby","members":2}`     | Room join confirmed                      |
| `{"type":"history","room":"lobby","messages":[…]}` | Recent messages for late joiners         |
| `{"type":"message","username":"bob","text":"hi"}`  | A chat message from someone else         |
| `{"type":"members","usernames":["alice","bob"]}`   | Current room occupancy                   |
| `{"type":"system","text":"bob joined lobby"}`      | Join/leave notifications                 |
| `{"type":"error","message":"…"}`                   | Invalid auth, bad JSON, rate limit, etc. |

## HTTP endpoints

| Method | Path          | Purpose                                   |
| ------ | ------------- | ----------------------------------------- |
| POST   | `/api/token`  | Issue a JWT for `{"username":"alice"}`    |
| GET    | `/api/rooms`  | List rooms with member counts             |

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the server (watch mode)      |
| `npm run dev:client` | Start the React dev server         |
| `npm test`           | Run the server unit tests          |
| `npm run cli -- …`   | Run the CLI (`start` / `connect`)  |

## Testing

```bash
npm test --workspace=@broadcast-server/server
```

Unit tests cover the room store (join, leave, empty-room cleanup, member counts)
and the rate limiter (limit enforcement, single warning, window reset). They are
pure logic — no database or running server required.

## Configuration

All settings are environment variables with development defaults:

| Variable                | Default                                 |
| ----------------------- | --------------------------------------- |
| `PORT`                  | `8080`                                  |
| `JWT_SECRET`            | `dev-secret-change-me`                  |
| `JWT_EXPIRES_IN`        | `7d`                                    |
| `MONGODB_URI`           | `mongodb://localhost:27017/broadcast`   |
| `HEARTBEAT_INTERVAL_MS` | `30000`                                 |
| `RATE_LIMIT_WINDOW_MS`  | `10000`                                 |
| `RATE_LIMIT_MAX`        | `20`                                    |

Set a real `JWT_SECRET` before deploying anywhere public.

## Project structure

```
server/
  src/       server modules (see table above)
  test/      unit tests
client/
  src/       React app: App.jsx, useBroadcastSocket.js, styles
.github/
  workflows/ CI pipeline
```
