const PORT = Number(process.env.PORT) || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/broadcast';
const HEARTBEAT_INTERVAL_MS =
  Number(process.env.HEARTBEAT_INTERVAL_MS) || 30000;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 10000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 20;
const MAX_PAYLOAD_BYTES = Number(process.env.MAX_PAYLOAD_BYTES) || 64 * 1024;
const MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH) || 2000;
const MAX_USERNAME_LENGTH = Number(process.env.MAX_USERNAME_LENGTH) || 32;

module.exports = {
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  MONGODB_URI,
  HEARTBEAT_INTERVAL_MS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  MAX_PAYLOAD_BYTES,
  MAX_MESSAGE_LENGTH,
  MAX_USERNAME_LENGTH,
};
