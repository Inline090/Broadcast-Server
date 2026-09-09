const PORT = Number(process.env.PORT) || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/broadcast';

module.exports = { PORT, JWT_SECRET, JWT_EXPIRES_IN, MONGODB_URI };
