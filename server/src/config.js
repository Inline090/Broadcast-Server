const PORT = Number(process.env.PORT) || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/broadcast';
const HEARTBEAT_INTERVAL_MS =
  Number(process.env.HEARTBEAT_INTERVAL_MS) || 30000;

module.exports = {
  PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  MONGODB_URI,
  HEARTBEAT_INTERVAL_MS,
};
