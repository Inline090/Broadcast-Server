// Server-side room membership: room name -> Set of sockets.
const rooms = new Map();

function join(socket, room) {
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room).add(socket);
  socket.room = room;
}

function members(room) {
  return rooms.get(room) || new Set();
}

module.exports = { join, members };
