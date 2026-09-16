const http = require('http');
const { signToken } = require('./auth');

// HTTP server exposing:
//   POST /api/token  -> issue a JWT for a username
//   GET  /api/rooms  -> list rooms with their member counts
function createHttpServer({ listRooms } = {}) {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/rooms') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rooms: listRooms ? listRooms() : [] }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/token') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { username } = JSON.parse(body);
          if (!username || typeof username !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'username is required' }));
            return;
          }
          const token = signToken(username);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid JSON body' }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}

module.exports = { createHttpServer };
