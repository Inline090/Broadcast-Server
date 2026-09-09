import { useEffect, useState } from 'react';
import useBroadcastSocket from './useBroadcastSocket';

const HOST = 'localhost';
const PORT = 8080;

export default function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('lobby');
  const [token, setToken] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const { status, messages, send } = useBroadcastSocket({
    host: HOST,
    port: PORT,
    token,
  });

  async function handleJoin(event) {
    event.preventDefault();
    if (!username.trim()) return;

    setJoining(true);
    setError(null);
    try {
      // Ask the server for a JWT, then open the WebSocket with it.
      const res = await fetch(`http://${HOST}:${PORT}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        throw new Error('Token request failed');
      }
      const data = await res.json();
      setToken(data.token);
    } catch (err) {
      setError('Could not connect to server. Is it running?');
    } finally {
      setJoining(false);
    }
  }

  // Join the chosen room once the socket is open.
  useEffect(() => {
    if (status === 'open') {
      send({ type: 'join', room });
    }
  }, [status, room, send]);

  if (!token) {
    return (
      <main className="login">
        <h1>Broadcast Server</h1>
        <p>Join a room and start chatting in real time.</p>
        <form onSubmit={handleJoin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            required
          />
          <button type="submit" disabled={joining}>
            {joining ? 'Joining...' : 'Join room'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="chat">
      <header>
        <h1>#{room}</h1>
        <span className={`status ${status}`}>{status}</span>
      </header>
      <div className="messages">
        {messages.map((msg, i) => {
          if (msg.type === 'message') {
            return (
              <div
                key={i}
                className={`message ${msg.username === username ? 'own' : ''}`}
              >
                <span className="author">{msg.username}</span>
                <span className="text">{msg.text}</span>
              </div>
            );
          }
          if (msg.type === 'system') {
            return (
              <div key={i} className="system">
                {msg.text}
              </div>
            );
          }
          if (msg.type === 'history') {
            return (
              <div key={i} className="system">
                Loaded {msg.messages.length} earlier messages
              </div>
            );
          }
          if (msg.type === 'error') {
            return (
              <div key={i} className="system error">
                {msg.message}
              </div>
            );
          }
          return null;
        })}
      </div>
    </main>
  );
}
