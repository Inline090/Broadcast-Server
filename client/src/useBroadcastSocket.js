import { useCallback, useEffect, useRef, useState } from 'react';

// React hook that manages a WebSocket connection to the broadcast server.
// Exposes connection status, a send() helper, and every parsed message the
// server sends (welcome, joined, history, members, system, chat, errors).
export default function useBroadcastSocket({ host, port, token }) {
  // connecting -> authenticating -> open, or closed
  const [status, setStatus] = useState('connecting');
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const shouldReconnectRef = useRef(true);

  const send = useCallback((payload) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    let socket;
    let retryTimer;
    let retryDelay = 1000;

    const connect = () => {
      shouldReconnectRef.current = true;
      setStatus('connecting');

      // No token in the URL — it would leak into logs and browser history.
      socket = new WebSocket(`ws://${host}:${port}`);
      socketRef.current = socket;

      socket.onopen = () => {
        // A successful connection resets the backoff for next time.
        retryDelay = 1000;
        // Authenticate as the first message instead.
        setStatus('authenticating');
        socket.send(JSON.stringify({ type: 'auth', token }));
      };

      socket.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        // The server's welcome means our token was accepted.
        if (msg.type === 'welcome') {
          setStatus('open');
        }
        setMessages((prev) => [...prev, msg]);
      };

      socket.onclose = () => {
        setStatus('closed');
        if (shouldReconnectRef.current) {
          // Exponential backoff: 1s, 2s, 4s, ... capped at 30s, so a server
          // that is down isn't hammered with a reconnect every second.
          retryTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(retryTimer);
      socket.close();
      socketRef.current = null;
    };
  }, [host, port, token]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return { status, messages, send, clearMessages };
}
