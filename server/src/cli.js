// broadcast-server CLI: start | connect
// Usage:
//   broadcast-server start [--port <n>]
//   broadcast-server connect [--host <h>] [--port <n>] [--room <r>] [--username <u>]
const readline = require('readline');
const WebSocket = require('ws');
const { signToken } = require('./auth');

const args = process.argv.slice(2);

function flagValue(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

function hasFlag(flag) {
  return args.includes(flag);
}

const command = args.find((a) => a === 'start' || a === 'connect');

function help() {
  console.log(`broadcast-server — real-time message broadcasting

Usage:
  broadcast-server start                Start the WebSocket broadcast server
      --port <n>                       Port to listen on (default 8080)

  broadcast-server connect             Connect to a running server as a chat client
      --host <h>                       Server host (default localhost)
      --port <n>                       Server port (default 8080)
      --room <r>                       Room to join (default lobby)
      --username <u>                   Username for the JWT (default anonymous)
`);
}

if (!command || hasFlag('--help') || hasFlag('-h')) {
  help();
  process.exit(command ? 0 : 1);
}

if (command === 'start') {
  const port = Number(flagValue('--port', '8080'));
  process.env.PORT = String(port);
  // index.js boots the server and registers graceful shutdown handlers.
  require('./index');
} else {
  runConnect();
}

function runConnect() {
  const host = flagValue('--host', 'localhost');
  const port = Number(flagValue('--port', '8080'));
  const room = flagValue('--room', 'lobby');
  const username = flagValue('--username', 'anonymous');

  // Mint a token locally — in a real deployment the server (or an auth
  // service) would hand this out after a login.
  const token = signToken(username);
  const url = `ws://${host}:${port}?token=${token}`;

  console.log(`Connecting to ${host}:${port} as ${username} (room: ${room})...`);
  console.log('Type a message and press Enter to send. Ctrl+C to quit.\n');

  const ws = new WebSocket(url);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${username}> `,
  });

  // stdin can deliver lines before the socket finishes connecting (e.g. piped
  // input), so queue sends until we know the connection is open.
  let connected = false;
  const pending = [];

  function send(text) {
    if (connected) {
      ws.send(JSON.stringify({ type: 'message', text }));
    } else {
      pending.push(text);
    }
  }

  // stdin ending (e.g. piped input) closes readline; never prompt a closed one.
  function safePrompt() {
    if (!rl.closed) {
      rl.prompt();
    }
  }

  ws.on('open', () => {
    connected = true;
    ws.send(JSON.stringify({ type: 'join', room }));
    while (pending.length) {
      ws.send(JSON.stringify({ type: 'message', text: pending.shift() }));
    }
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // History replay is multi-line; print it before the next prompt.
    if (msg.type === 'history') {
      console.log(`\n--- recent history in #${msg.room} ---`);
      msg.messages.forEach((m) => console.log(`  ${m.username}: ${m.text}`));
      console.log('--- end history ---\n');
      safePrompt();
      return;
    }

    if (msg.type === 'message') {
      console.log(`\n${msg.username}: ${msg.text}`);
    } else if (msg.type === 'system') {
      console.log(`\n* ${msg.text}`);
    } else {
      console.log(`\n[${msg.type}]`, msg.message || '');
    }
    safePrompt();
  });

  rl.on('line', (line) => {
    const text = line.trim();
    if (text) {
      send(text);
    }
    safePrompt();
  });

  ws.on('close', () => {
    console.log('\nDisconnected from server.');
    rl.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('Connection error:', err.message);
    rl.close();
    process.exit(1);
  });
}
