# Broadcast Server

A real-time message broadcasting platform built with Node.js, WebSockets, MongoDB, React, and Vite. Clients join a room over a persistent WebSocket connection and instantly receive every message sent by others in that room, with history persisted so anyone joining late can catch up.

## Features

- **Real-time broadcast**: messages fan out instantly to everyone in a room, never back to the sender
- **Rooms (channels)**: join a named room and all broadcasts stay scoped to it
- **Live member list**: the server pushes current room occupancy on every join and leave
- **JWT authentication**: the socket stays unauthenticated until it presents a valid token, and identity always comes from the token rather than the client's claims
- **Message history**: every message is stored in MongoDB and replayed to late joiners
- **Input limits**: capped frame size, message length, and username length
- **Rate limiting**: per-socket send limits stop a single client flooding a room
- **Heartbeat**: unresponsive half-open connections are detected and cleaned up
- **Graceful shutdown**: Ctrl+C closes client sockets, the HTTP server, and the database connection in order
- **CLI**: start the server or chat from the terminal
- **Docker support**: one command brings up the database, server, and client

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for MongoDB) or an existing MongoDB instance

### 1. Clone and Install

```bash
git clone <your-github-repo-url>
cd Broadcast-Server
npm install
```

### 2. Start MongoDB

```bash
docker run -d --name broadcast-mongo -p 27017:27017 -v broadcast-mongo-data:/data/db mongo:7
```

That runs MongoDB with a named volume, so message history survives restarts.

### 3. Configure Environment

Copy `.env.example` to `.env` and adjust if needed:

```env
PORT=8080
JWT_SECRET=change_this_to_a_real_secret
MONGODB_URI=mongodb://localhost:27017/broadcast
```

Every setting has a development default, so the project also runs with no `.env` at all. The file is loaded automatically by the npm scripts.

### 4. Run the Server and Client

In two terminals:

```bash
npm run dev         # WebSocket + HTTP server on :8080
```

```bash
npm run dev:client  # React client on :5173
```

### 5. Use the App

Open `http://localhost:5173`, enter a username and room name, and click Join room. Open a second browser tab with a different username in the same room to see messages and the member list update live.

### 6. Chat from the Terminal

```bash
npm run cli -- start --port 8090
npm run cli -- connect --username alice --room lobby
```

## Project Structure

```
server/
├── src/
│   ├── index.js        connection lifecycle, auth, join, chat handling
│   ├── config.js       environment-driven settings
│   ├── auth.js         JWT sign and verify helpers
│   ├── rooms.js        room membership (join, leave, usernames, listing)
│   ├── history.js      Mongoose model and history queries
│   ├── rateLimit.js    fixed-window per-socket limiter
│   ├── httpServer.js   HTTP routes (token, rooms, health)
│   └── cli.js          start and connect commands
└── test/
    ├── rooms.test.js
    ├── rateLimit.test.js
    └── integration.test.js

client/
├── src/
│   ├── App.jsx                 login screen and chat UI
│   ├── useBroadcastSocket.js   connection and reconnect hook
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
├── nginx.conf
└── Dockerfile

.github/workflows/ci.yml
docker-compose.yml
```

## WebSocket Protocol

All frames are JSON. The first frame a client sends must authenticate the connection.

Client to server:

| Message                           | Purpose                |
| --------------------------------- | ---------------------- |
| `{"type":"auth","token":"<jwt>"}` | Required first message |
| `{"type":"join","room":"lobby"}`  | Join or switch rooms   |
| `{"type":"message","text":"hi"}`  | Send a chat message    |

Server to client:

| Message                                                          | Purpose                                       |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `{"type":"welcome","username":"alice"}`                          | Authentication accepted                       |
| `{"type":"joined","room":"lobby","members":2}`                   | Room join confirmed                           |
| `{"type":"history","room":"lobby","messages":[...]}`             | Recent messages for late joiners              |
| `{"type":"message","username":"bob","text":"hi","sentAt":"..."}` | A chat message from someone else              |
| `{"type":"members","usernames":["alice","bob"]}`                 | Current room occupancy                        |
| `{"type":"system","text":"bob joined lobby"}`                    | Join and leave notifications                  |
| `{"type":"error","message":"..."}`                               | Invalid auth, bad JSON, rate limit, and so on |

## HTTP Endpoints

| Method | Path         | Purpose                                |
| ------ | ------------ | -------------------------------------- |
| POST   | `/api/token` | Issue a JWT for `{"username":"alice"}` |
| GET    | `/api/rooms` | List rooms with member counts          |
| GET    | `/health`    | Liveness probe                         |

## Available Scripts

- `npm run dev` - start the server in watch mode
- `npm run start` - start the server
- `npm run dev:client` - start the React development server
- `npm test` - run the server test suite
- `npm run lint` - run ESLint
- `npm run format` - format the codebase with Prettier
- `npm run cli -- <command>` - run the CLI

## Configuration

| Variable                | Default                               |
| ----------------------- | ------------------------------------- |
| `PORT`                  | `8080`                                |
| `JWT_SECRET`            | `dev-secret-change-me`                |
| `JWT_EXPIRES_IN`        | `7d`                                  |
| `MONGODB_URI`           | `mongodb://localhost:27017/broadcast` |
| `HEARTBEAT_INTERVAL_MS` | `30000`                               |
| `RATE_LIMIT_WINDOW_MS`  | `10000`                               |
| `RATE_LIMIT_MAX`        | `20`                                  |
| `MAX_PAYLOAD_BYTES`     | `65536`                               |
| `MAX_MESSAGE_LENGTH`    | `2000`                                |
| `MAX_USERNAME_LENGTH`   | `32`                                  |

Set a real `JWT_SECRET` before deploying anywhere public.

## Testing

```bash
npm test
```

The suite uses Node's built-in test runner, so there is no extra test dependency. Unit tests cover the room store and the rate limiter; the integration test spawns a real server against a test database and verifies fan-out, sender exclusion, timestamps, and history replay for late joiners.

The integration test needs a running MongoDB. In CI it is provided as a service container.

## Deployment

### 1. Docker Compose

```bash
docker compose up --build
```

This starts MongoDB, the server on `http://localhost:8080`, and the client served by nginx on `http://localhost:5173`. Settings can be overridden with environment variables:

```bash
JWT_SECRET=a-real-secret docker compose up
```

### 2. Server Hosting

The server is a plain Node process, so it runs anywhere Node runs:

1. Set `MONGODB_URI` to your database, for example a managed MongoDB cluster
2. Set a strong `JWT_SECRET`
3. Start it with `npm start`

The server exposes `/health` for load balancer and uptime checks.

### 3. Client Hosting

The client is a static build:

```bash
npm run build --workspace=client
```

Deploy the contents of `client/dist` to any static host, and point `HOST` and `PORT` in `client/src/App.jsx` at your deployed server.

## Security Features

- **Token-based identity**: usernames are read from the verified JWT, never from client-supplied fields
- **No credentials in URLs**: the token travels in the first WebSocket frame rather than the connection URL, so it cannot leak into logs or browser history
- **Authentication timeout**: a socket that does not authenticate within five seconds is closed
- **Input validation**: frame size, message length, and username length are all capped
- **Rate limiting**: per-socket limits with a single warning per window
- **Secrets kept out of git**: `.env` is ignored and `.env.example` documents the available settings

## Key Technologies

- **Backend**: Node.js, `ws` for WebSockets, the built-in `http` module
- **Database**: MongoDB with Mongoose
- **Authentication**: JSON Web Tokens via `jsonwebtoken`
- **Frontend**: React 19, Vite
- **Testing**: Node's built-in `node:test` runner
- **Quality**: ESLint, Prettier, GitHub Actions
- **Packaging**: Docker, Docker Compose, nginx

## Features Overview

### Authentication

The client exchanges a username for a JWT over HTTP, then presents that token as the first WebSocket frame. The server keeps the socket unauthenticated until the token verifies, and derives the username from the token payload. The CLI signs its own tokens because it runs with the server's secret.

### Rooms and Messaging

Rooms are held in memory as a map of room name to the set of connected sockets. Messages are validated, persisted, then fanned out to the sender's room only, excluding the sender. The client echoes its own message locally so it appears immediately.

### History and Catch-Up

Every message is written to MongoDB before it is broadcast. When a client joins a room, the server replays the most recent messages for that room, so a late joiner sees the conversation so far and then continues with live messages.

### Reliability and Operations

A heartbeat pings every client on an interval and terminates any socket that stops responding, so half-open connections do not linger in rooms. Rate limiting keeps one client from flooding a room, and graceful shutdown closes sockets, the HTTP server, and the database connection cleanly.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m "Add feature"`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you have any questions or run into a problem:

1. Check the Configuration and Testing sections above
2. Review the WebSocket Protocol section for the message contract
3. Open an issue on GitHub

---

A real-time broadcasting platform built with Node.js, WebSockets, and React.
