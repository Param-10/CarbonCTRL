import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { MIGRATIONS_DIR, migrationsUpTo } from './helpers/migrations.js';

// Runs migrations directly (not through db/index.js) so the database can be
// stopped at 0003, seeded with an activity that predates activity dates, and
// then brought up to date.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbonctrl-backfill-'));

describe('migration 0004: activity dates', () => {
  const sqlite = new Database(path.join(workDir, 'test.db'));
  const db = drizzle(sqlite);

  it('backfills existing activities with their creation date', () => {
    migrate(db, { migrationsFolder: migrationsUpTo(workDir, '0003_add_profile_recommendation_context') });

    const createdAt = Date.UTC(2025, 10, 20, 15, 30); // 2025-11-20 15:30 UTC
    sqlite
      .prepare(
        `INSERT INTO carbon_activities
          (assessment_id, user_id, sector, subsector, activity_amount, activity_unit, created_at, updated_at)
         VALUES (1, 1, 'power', 'electricity-generation', 100, 'kWh', ?, ?)`
      )
      .run(createdAt, createdAt);

    migrate(db, { migrationsFolder: MIGRATIONS_DIR });

    const row = sqlite.prepare('SELECT activity_date FROM carbon_activities').get();
    expect(row.activity_date).toBe('2025-11-20');
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
