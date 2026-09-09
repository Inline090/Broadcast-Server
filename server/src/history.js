const mongoose = require('mongoose');

// A single message in a room's history. Indexed by room + createdAt so the
// "replay recent history" query stays fast as the collection grows.
const messageSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, index: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ room: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

async function saveMessage(room, username, text) {
  return Message.create({ room, username, text });
}

// Most recent `limit` messages for a room, oldest first (chronological replay).
async function recentMessages(room, limit = 50) {
  const messages = await Message.find({ room })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return messages.reverse();
}

module.exports = { saveMessage, recentMessages };
