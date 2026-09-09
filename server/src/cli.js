// broadcast-server CLI: start | connect
// Usage:
//   broadcast-server start [--port <n>]
//   broadcast-server connect [--host <h>] [--port <n>] [--room <r>] [--username <u>]
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
  // Connect is wired up in a later commit.
  console.error('connect command not implemented yet');
  process.exit(1);
}
