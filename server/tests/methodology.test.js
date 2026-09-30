import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-methodology');

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');
const { gridFactorForState, US_GRID_T_PER_KWH } = await import('../config/stateGridFactors.js');

const agent = request(app);
const gridFactor = (body) => body.factors.find((f) => f.subsector === 'grid-electricity').factor;

describe('methodology API', () => {
  it('is public and lists every factor with its source', async () => {
    const res = await agent.get('/api/methodology');

    expect(res.status).toBe(200);
    expect(res.body.state).toBeNull();
    expect(res.body.factors.length).toBeGreaterThan(30);
    for (const factor of res.body.factors) {
      expect(res.body.sources[factor.source], factor.subsector).toBeTruthy();
    }
    expect(gridFactor(res.body)).toBe(US_GRID_T_PER_KWH);
    expect(res.body.grid.states).toHaveLength(52);
    expect(res.body.grid.states[0]).toEqual({ code: 'AL', name: 'Alabama', lb_per_mwh: 714 });
    expect(res.body.grading.bands.at(-1)).toEqual({ grade: 'F', max_ratio: null });
  });

  it('tailors grid factors and benchmarks to a state', async () => {
    const res = await agent.get('/api/methodology?state=WV');

    expect(res.body.state).toBe('WV');
    expect(gridFactor(res.body)).toBe(gridFactorForState('WV'));
    const technology = res.body.benchmarks.find((b) => b.industry === 'Technology');
    expect(technology).toMatchObject({ basis: 'building_energy', value: 6.77 });
  });

  it('ignores an unknown state', async () => {
    const res = await agent.get('/api/methodology?state=ZZ');

    expect(res.body.state).toBeNull();
    expect(gridFactor(res.body)).toBe(US_GRID_T_PER_KWH);
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});
