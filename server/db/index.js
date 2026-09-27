/**
 * SQLite database connection for CarbonCTRL.
 *
 * Uses better-sqlite3 (synchronous, file-backed, zero services) with Drizzle
 * ORM as the query layer. The database file lives at server/data/carbonctrl.db
 * (gitignored) and is created automatically on first run. Drizzle migrations
 * are applied at startup, so `npm run server` just works with no remote DB.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'carbonctrl.db');

// Ensure the data directory exists (server/data is gitignored).
fs.mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(DB_PATH);

// Robust local-first configuration.
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

const db = drizzle(sqlite);

// Apply schema migrations on startup (idempotent).
migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });

console.log(`SQLite database ready at ${DB_PATH}`);

/** Cheap database liveness check for the /health endpoint. */
export function pingDatabase() {
  const row = sqlite.prepare('SELECT 1 AS ok').get();
  return row?.ok === 1;
}

export { db, sqlite, sql };