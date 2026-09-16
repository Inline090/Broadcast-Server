const test = require('node:test');
const assert = require('node:assert');
const rateLimit = require('../src/rateLimit');
const { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = require('../src/config');

test('allows up to the limit within a window', () => {
  const socket = {};
  const now = 1_000_000;

  for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
    assert.strictEqual(rateLimit.check(socket, now).allowed, true);
  }
});

test('drops messages past the limit and warns only once', () => {
  const socket = {};
  const now = 2_000_000;

  for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
    rateLimit.check(socket, now);
  }

  const first = rateLimit.check(socket, now);
  assert.strictEqual(first.allowed, false);
  assert.strictEqual(first.firstWarning, true);

  const second = rateLimit.check(socket, now);
  assert.strictEqual(second.allowed, false);
  assert.strictEqual(second.firstWarning, false);
});

test('resets once the window elapses', () => {
  const socket = {};
  const now = 3_000_000;

  for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
    rateLimit.check(socket, now);
  }
  assert.strictEqual(rateLimit.check(socket, now).allowed, false);

  const later = now + RATE_LIMIT_WINDOW_MS + 1;
  assert.strictEqual(rateLimit.check(socket, later).allowed, true);
});
