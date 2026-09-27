import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// DATABASE_PATH must be set before db/index.js is evaluated (it runs the
// Drizzle migrations at import time). Static imports are evaluated first, so
// the db module is pulled in dynamically once the temp path is in place.
const dbPath = setTempDb('carbonctrl-migrate');

let sqlite;

describe('SQLite schema migration', () => {
  beforeAll(async () => {
    const dbModule = await import('../db/index.js');
    sqlite = dbModule.sqlite;
  });

  it('applies migration 0000: creates all application tables', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);

    for (const expected of [
      'users',
      'company_profiles',
      'carbon_assessments',
      'carbon_activities',
      'emissions',
    ]) {
      expect(tables).toContain(expected);
    }
  });

  it('applies migration 0001: token_version + reset columns on users', () => {
    const columns = sqlite.prepare('PRAGMA table_info(users)').all().map((c) => c.name);

    expect(columns).toContain('token_version');
    expect(columns).toContain('reset_password_token');
    expect(columns).toContain('reset_password_expires');
    expect(columns).toContain('two_factor_secret');
    expect(columns).toContain('google_id');
  });

  it('enforces the unique email constraint', () => {
    const insert = (email, ts) =>
      sqlite
        .prepare(
          "INSERT INTO users (email, created_at, updated_at) VALUES (?, ?, ?)"
        )
        .run(email, ts, ts);

    insert('dup@test.com', 1);
    expect(() => insert('dup@test.com', 2)).toThrow();
  });

  it('enforces the unique google_id constraint', () => {
    const insert = (googleId) =>
      sqlite
        .prepare(
          "INSERT INTO users (email, google_id, created_at, updated_at) VALUES (?, ?, ?, ?)"
        )
        .run(`g-${googleId}@test.com`, googleId, 1, 1);

    insert('google-a');
    expect(() => insert('google-a')).toThrow();
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});