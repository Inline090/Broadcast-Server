const http = require('http');
const { signToken } = require('./auth');

// HTTP server exposing the token endpoint. The browser client calls
// POST /api/token to get a JWT, then opens the WebSocket with it — the CLI
// mints tokens locally because it shares the secret, but a browser cannot,
// so the server issues them here.
function createHttpServer() {
  return http.createServer((req, res) => {
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
