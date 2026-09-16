const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');
const WebSocket = require('ws');
const { signToken } = require('../src/auth');

const PORT = 8099;
const MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/broadcast-test';
const ROOM = `itest-${Date.now()}`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForPort(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const s = net.connect(port, 'localhost');
      s.on('connect', () => {
        s.end();
        resolve(true);
      });
      s.on('error', () => resolve(false));
    });
    if (ok) return;
    await wait(300);
  }
  throw new Error(`server did not start on port ${port}`);
}

// Minimal test client: queues incoming frames and lets a test await one
// matching a predicate.
function connect(username) {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const seen = [];
  const waiters = [];

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    seen.push(msg);
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      if (waiters[i].predicate(msg)) {
        const { resolve } = waiters[i];
        waiters.splice(i, 1);
        resolve(msg);
      }
    }
  });

  const authenticated = new Promise((resolve) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token: signToken(username) }));
      resolve();
    });
  });

  return {
    authenticated,
    send: (obj) => ws.send(JSON.stringify(obj)),
    waitFor: (predicate, timeoutMs = 5000) =>
      new Promise((resolve, reject) => {
        const existing = seen.find(predicate);
        if (existing) return resolve(existing);
        const timer = setTimeout(
          () => reject(new Error('timed out waiting for a message')),
          timeoutMs,
        );
        waiters.push({
          predicate,
          resolve: (msg) => {
            clearTimeout(timer);
            resolve(msg);
          },
        });
        return undefined;
      }),
    close: () => ws.close(),
  };
}

test('fans out messages to a room and replays history to late joiners', async (t) => {
  const server = spawn(process.execPath, ['src/index.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), MONGODB_URI },
    stdio: 'ignore',
  });
  t.after(() => server.kill());

  await waitForPort(PORT);

  // Alice joins first and waits for her room.
  const alice = connect('alice');
  await alice.authenticated;
  await alice.waitFor((m) => m.type === 'welcome');
  alice.send({ type: 'join', room: ROOM });
  await alice.waitFor((m) => m.type === 'joined');

  // Bob joins and sends a message.
  const bob = connect('bob');
  await bob.authenticated;
  await bob.waitFor((m) => m.type === 'welcome');
  bob.send({ type: 'join', room: ROOM });
  await bob.waitFor((m) => m.type === 'joined');
  bob.send({ type: 'message', text: 'hello integration' });

  const delivered = await alice.waitFor((m) => m.type === 'message');
  assert.strictEqual(delivered.text, 'hello integration');
  assert.strictEqual(delivered.username, 'bob');
  assert.ok(delivered.sentAt, 'broadcast messages should carry a timestamp');

  // The sender is excluded from their own broadcast.
  const echoed = await bob
    .waitFor((m) => m.type === 'message', 600)
    .catch(() => null);
  assert.strictEqual(
    echoed,
    null,
    'sender should not receive their own message',
  );

  // A late joiner receives the message as history.
  const carol = connect('carol');
  await carol.authenticated;
  await carol.waitFor((m) => m.type === 'welcome');
  carol.send({ type: 'join', room: ROOM });
  const history = await carol.waitFor((m) => m.type === 'history');
  assert.ok(
    history.messages.some((m) => m.text === 'hello integration'),
    'history should contain the earlier message',
  );

  alice.close();
  bob.close();
  carol.close();
});
