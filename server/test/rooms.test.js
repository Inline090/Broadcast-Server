const test = require('node:test');
const assert = require('node:assert');
const rooms = require('../src/rooms');

test('join adds a socket to a room', () => {
  const socket = { username: 'alice' };
  rooms.join(socket, 'general');

  assert.deepStrictEqual(rooms.usernames('general'), ['alice']);
  assert.strictEqual(socket.room, 'general');

  rooms.leave(socket);
});

test('leave removes the socket and deletes the room when empty', () => {
  const socket = { username: 'bob' };
  rooms.join(socket, 'temporary');
  rooms.leave(socket);

  assert.strictEqual(rooms.usernames('temporary').length, 0);
  assert.strictEqual(
    rooms.list().find((r) => r.name === 'temporary'),
    undefined
  );
});

test('list reports member counts per room', () => {
  const alice = { username: 'alice' };
  const bob = { username: 'bob' };
  rooms.join(alice, 'counted');
  rooms.join(bob, 'counted');

  const entry = rooms.list().find((r) => r.name === 'counted');
  assert.strictEqual(entry.members, 2);

  rooms.leave(alice);
  rooms.leave(bob);
});

test('usernames skips sockets that never authenticated', () => {
  const anonymous = {};
  rooms.join(anonymous, 'mixed');
  assert.deepStrictEqual(rooms.usernames('mixed'), []);
  rooms.leave(anonymous);
});
