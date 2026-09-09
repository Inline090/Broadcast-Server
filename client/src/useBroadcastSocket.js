import { useCallback, useEffect, useRef, useState } from 'react';

// React hook that manages a WebSocket connection to the broadcast server.
// Exposes connection status, a send() helper, and every parsed message the
// server sends (welcome, joined, history, system, chat messages, errors).
export default function useBroadcastSocket({ host, port, token }) {
  const [status, setStatus] = useState('connecting'); // connecting | open | closed
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

    const connect = () => {
      shouldReconnectRef.current = true;
      setStatus('connecting');
      const url = `ws://${host}:${port}?token=${token}`;
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => setStatus('open');

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setMessages((prev) => [...prev, msg]);
        } catch {
          // Ignore malformed frames from the server.
        }
      };

      socket.onclose = () => {
        setStatus('closed');
        if (shouldReconnectRef.current) {
          // Naive fixed-interval retry; a later commit adds backoff.
          retryTimer = setTimeout(connect, 1000);
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
