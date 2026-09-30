import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { MIGRATIONS_DIR, migrationsUpTo } from './helpers/migrations.js';
import { isValidCombination } from '../config/emissionFactors.js';

// Seed activities in the old IPCC-style sectors at migration 0006, then run
// 0007 and check each lands in the right US category with converted units.
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carbonctrl-categories-'));

describe('migration 0007: US business categories', () => {
  const sqlite = new Database(path.join(workDir, 'test.db'));
  const db = drizzle(sqlite);

  const OLD_ROWS = [
    ['power', 'electricity-generation', 1000],
    ['power', 'solar-generation', 500],
    ['power', 'heat-plants', 1000],
    ['transportation', 'road', 100],
    ['transportation', 'aviation', 1000],
    ['transportation', 'shipping', 1000],
    ['buildings', 'heating', 293.071],
    ['buildings', 'lighting', 200],
    ['buildings', 'commercial', 5000],
    ['manufacturing', 'steel', 10],
    ['waste', 'landfill', 1],
    ['waste', 'wastewater', 1],
    ['agriculture', 'rice-cultivation', 1],
    ['agriculture', 'enteric-fermentation', 40],
  ];

  it('moves every old activity to a valid category, converting units', () => {
    migrate(db, { migrationsFolder: migrationsUpTo(workDir, '0006_add_recommendation_sets') });

    const insert = sqlite.prepare(
      `INSERT INTO carbon_activities
        (assessment_id, user_id, sector, subsector, activity_amount, activity_unit, activity_date, created_at, updated_at)
       VALUES (1, 1, ?, ?, ?, 'old unit', '2026-01-15', 1, 1)`
    );
    OLD_ROWS.forEach(([sector, subsector, amount]) => insert.run(sector, subsector, amount));
    sqlite.prepare("INSERT INTO emissions (user_id, type, amount, created_at, updated_at) VALUES (1, 'power', 1, 1, 1)").run();

    migrate(db, { migrationsFolder: MIGRATIONS_DIR });

    const rows = sqlite.prepare('SELECT sector, subsector, activity_amount AS amount, activity_unit AS unit FROM carbon_activities ORDER BY id').all();
    expect(rows).toHaveLength(OLD_ROWS.length);
    for (const row of rows) {
      expect(isValidCombination(row.sector, row.subsector), `${row.sector}/${row.subsector}`).toBe(true);
      expect(row.unit).not.toBe('old unit');
    }

    const at = (i) => rows[i];
    expect(at(0)).toMatchObject({ sector: 'electricity', subsector: 'grid-electricity', amount: 1000 });
    expect(at(1)).toMatchObject({ sector: 'electricity', subsector: 'onsite-renewable', amount: 500 });
    expect(at(2).amount).toBeCloseTo(3.412); // kWh -> MMBtu
    expect(at(3)).toMatchObject({ sector: 'vehicles', subsector: 'car-miles' });
    expect(at(3).amount).toBeCloseTo(62.1371); // km -> miles
    expect(at(4)).toMatchObject({ sector: 'business_travel', subsector: 'flight-medium-long' });
    expect(at(5)).toMatchObject({ sector: 'freight', subsector: 'ship' });
    expect(at(6)).toMatchObject({ sector: 'heating_cooling', subsector: 'natural-gas' });
    expect(at(6).amount).toBeCloseTo(10, 3); // kWh of heat -> therms
    expect(at(7)).toMatchObject({ sector: 'electricity', subsector: 'grid-electricity', amount: 200 });
    expect(at(8)).toMatchObject({ sector: 'heating_cooling', subsector: 'facility-estimate', amount: 5000 });
    expect(at(9)).toMatchObject({ sector: 'materials', subsector: 'steel' });
    expect(at(9).amount).toBeCloseTo(11.0231); // tonnes -> short tons
    expect(at(10).amount).toBeCloseTo(2204.62); // tonnes -> lbs
    expect(at(11).amount).toBeCloseTo(264.172); // m3 -> gallons
    expect(at(12).amount).toBeCloseTo(2.47105); // hectares -> acres
    expect(at(13)).toMatchObject({ sector: 'agriculture', subsector: 'cattle-enteric', amount: 40 });

    // Stale per-sector rows are cleared; they are rebuilt on the next change
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM emissions').get().n).toBe(0);
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  });
});
