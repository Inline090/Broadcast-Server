const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = require('./config');

// Fixed-window rate limiter, per socket: allows RATE_LIMIT_MAX messages per
// RATE_LIMIT_WINDOW_MS, then drops the rest until the window resets. Returns
// firstWarning so the caller warns the client once per window instead of on
// every dropped message (which would itself be a flood).
function check(socket, now = Date.now()) {
  const state = socket.rateLimit;

  if (!state || now - state.windowStart > RATE_LIMIT_WINDOW_MS) {
    socket.rateLimit = { windowStart: now, count: 1, warned: false };
    return { allowed: true };
  }

  state.count += 1;
  if (state.count > RATE_LIMIT_MAX) {
    const firstWarning = !state.warned;
    state.warned = true;
    return { allowed: false, firstWarning };
  }

  return { allowed: true };
}

module.exports = { check };
