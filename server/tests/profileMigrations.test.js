import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { MIGRATIONS_DIR, migrationsUpTo } from './helpers/migrations.js';

// Stops at 0008, seeds profiles the way older versions saved them, then
// applies the rest (0009 state backfill, 0010 employee range rename)
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbonctrl-profiles-'));

describe('profile data migrations', () => {
  const sqlite = new Database(path.join(workDir, 'test.db'));
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: migrationsUpTo(workDir, '0008_add_action_plan_and_reminders') });
  const insert = sqlite.prepare(
    `INSERT INTO company_profiles (user_id, name, industry, employees, location, created_at, updated_at)
     VALUES (?, 'Co', 'Retail', ?, ?, 1, 1)`
  );
  const seeded = [
    ['1-10', 'Austin, TX'],
    ['250-500', ' denver, co '],
    ['500+', 'Leeds, UK'],
    ['11-50', 'Seattle'],
    ['51-200', 'Portland, Oregon'],
  ];
  seeded.forEach(([employees, location], index) => insert.run(index + 1, employees, location));
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  const rows = sqlite.prepare('SELECT state, employees FROM company_profiles ORDER BY user_id').all();

  it('0009 fills in the state only from locations written as "City, ST"', () => {
    expect(rows.map((row) => row.state)).toEqual(['TX', 'CO', null, null, null]);
  });

  it('0010 renames the 250-500 employee range to 201-500 and leaves the others', () => {
    expect(rows.map((row) => row.employees)).toEqual(['1-10', '201-500', '500+', '11-50', '51-200']);
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
