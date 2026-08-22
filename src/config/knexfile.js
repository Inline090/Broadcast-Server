const connection = require('./database');

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: {
      directory: '../db/migrations',
      tableName: 'knex_migrations',
    },
    pool: { min: 2, max: 10 },
  },
  production: {
    client: 'pg',
    connection,
    migrations: {
      directory: '../db/migrations',
      tableName: 'knex_migrations',
    },
    pool: { min: 2, max: 10 },
  },
};
