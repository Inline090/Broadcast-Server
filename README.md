# Taskboard

A task management API built with Node.js, Express, and PostgreSQL. Features JWT authentication, request rate limiting, input validation with Joi, and a soft-delete enabled data model.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** PostgreSQL (via `knex` query builder and `pg` driver)
- **Auth:** JWT (`jsonwebtoken`) with password hashing (`bcryptjs`)
- **Validation:** Joi
- **Security:** `express-rate-limit`, `cors`
- **Logging:** `morgan`

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (running locally on port `5432` by default)

### Setup

1. Clone the repository:

   ```sh
   git clone https://github.com/Inline090/taskboard.git
   cd taskboard
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Configure environment variables:

   ```sh
   cp .env.example .env
   ```

   Then update `.env` with your database credentials and a real `JWT_SECRET`.

4. Run database migrations:

   ```sh
   npm run migrate
   ```

5. Start the server:

   ```sh
   npm run dev
   ```

   The API will be available at `http://localhost:3000`.

## Environment Variables

| Variable               | Default                         | Description                       |
| ---------------------- | ------------------------------- | --------------------------------- |
| `PORT`                 | `3000`                          | Server port                       |
| `NODE_ENV`             | `development`                   | Runtime environment               |
| `DB_HOST`              | `localhost`                     | PostgreSQL host                   |
| `DB_PORT`              | `5432`                          | PostgreSQL port                   |
| `DB_NAME`              | `taskboard`                     | Database name                     |
| `DB_USER`              | `postgres`                      | Database user                     |
| `DB_PASSWORD`          | `postgres`                      | Database password                 |
| `JWT_SECRET`           | `dev_secret_do_not_use_in_prod` | Secret for signing JWTs           |
| `JWT_EXPIRES_IN`       | `7d`                            | JWT token expiry                  |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min)               | Rate limit window in milliseconds |
| `RATE_LIMIT_MAX`       | `100`                           | Max requests per window           |

## Scripts

| Script     | Command                 | Description                    |
| ---------- | ----------------------- | ------------------------------ |
| `start`    | `node src/index.js`     | Start in production            |
| `dev`      | `nodemon src/index.js`  | Start with hot reload          |
| `migrate`  | `knex migrate:latest`   | Apply pending migrations       |
| `rollback` | `knex migrate:rollback` | Roll back the latest migration |
| `seed`     | `knex seed:run`         | Run database seeds             |

## Project Structure

```
taskboard/
├── src/
│   ├── config/
│   │   ├── env.js           # Environment variable loading
│   │   ├── database.js      # PostgreSQL connection
│   │   └── knexfile.js      # Knex configuration
│   └── db/
│       └── migrations/      # Database migrations
├── .env.example
├── .gitignore
├── knexfile.js
├── package.json
└── README.md
```

## Data Model

### `users`

| Column          | Type      | Notes               |
| --------------- | --------- | ------------------- |
| `id`            | integer   | Primary key         |
| `email`         | varchar   | Unique, not null    |
| `password_hash` | varchar   | Not null            |
| `name`          | varchar   | Not null            |
| `created_at`    | timestamp | Defaults to now     |
| `updated_at`    | timestamp | Defaults to now     |
| `deleted_at`    | timestamp | Soft-delete support |
