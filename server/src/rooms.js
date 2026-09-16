// Server-side room membership: room name -> Set of sockets.
const rooms = new Map();

function join(socket, room) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room).add(socket);
  socket.room = room;
}

function leave(socket) {
  const room = socket.room;
  if (room && rooms.has(room)) {
    rooms.get(room).delete(socket);
    if (rooms.get(room).size === 0) {
      rooms.delete(room);
    }
  }
  delete socket.room;
}

function members(room) {
  return rooms.get(room) || new Set();
}

// Usernames currently in a room, for the live member list.
function usernames(room) {
  const set = rooms.get(room);
  if (!set) return [];
  const names = [];
  set.forEach((socket) => {
    if (socket.username) names.push(socket.username);
  });
  return names;
}

module.exports = { join, leave, members, usernames };
