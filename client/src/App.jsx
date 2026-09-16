import { useEffect, useMemo, useRef, useState } from 'react';
import useBroadcastSocket from './useBroadcastSocket';

const HOST = 'localhost';
const PORT = 8080;

export default function App() {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('lobby');
  const [token, setToken] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState('');
  const [feed, setFeed] = useState([]);

  const { status, messages, send } = useBroadcastSocket({
    host: HOST,
    port: PORT,
    token,
  });

  const processedRef = useRef(0);
  const bottomRef = useRef(null);

  // Join the chosen room once the socket is open.
  useEffect(() => {
    if (status === 'open') {
      send({ type: 'join', room });
    }
  }, [status, room, send]);

  // Fold incoming server events into the display feed. History replays are
  // expanded into individual messages so late joiners see them inline.
  useEffect(() => {
    if (messages.length <= processedRef.current) return;
    const fresh = messages.slice(processedRef.current);
    processedRef.current = messages.length;

    const items = [];
    fresh.forEach((m) => {
      if (m.type === 'history') {
        m.messages.forEach((h) =>
          items.push({ type: 'message', username: h.username, text: h.text })
        );
      } else {
        items.push(m);
      }
    });
    if (items.length) {
      setFeed((prev) => [...prev, ...items]);
    }
  }, [messages]);

  // Latest member list reported by the server.
  const members = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'members') return messages[i].usernames;
    }
    return [];
  }, [messages]);

  // Collapse connecting/authenticating into one "connecting" label.
  const displayStatus =
    status === 'open' ? 'connected' : status === 'closed' ? 'closed' : 'connecting';

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [feed]);

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

  function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    send({ type: 'message', text });
    // The server excludes the sender from broadcasts, so echo our own
    // message locally for immediate feedback.
    setFeed((prev) => [
      ...prev,
      { type: 'message', username, text, own: true },
    ]);
    setDraft('');
  }

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
        <span className={`status ${displayStatus}`}>
          {displayStatus}
        </span>
      </header>

      <div className="body">
        <div className="messages">
          {feed.map((item, i) => {
            if (item.type === 'message') {
              const isOwn = item.own || item.username === username;
              return (
                <div key={i} className={`message ${isOwn ? 'own' : ''}`}>
                  <span className="author">{item.username}</span>
                  <span className="text">{item.text}</span>
                </div>
              );
            }
            if (item.type === 'system') {
              return (
                <div key={i} className="system">
                  {item.text}
                </div>
              );
            }
            if (item.type === 'error') {
              return (
                <div key={i} className="system error">
                  {item.message}
                </div>
              );
            }
            return null;
          })}
          <div ref={bottomRef} />
        </div>

        <aside className="members">
          <h2>In this room</h2>
          <ul>
            {members.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </aside>
      </div>

      <form className="send" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={status !== 'open'}
        />
        <button type="submit" disabled={status !== 'open'}>
          Send
        </button>
      </form>
    </main>
  );
}
