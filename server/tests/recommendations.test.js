import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-recommendations');
delete process.env.GEMINI_API_KEY;

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');

const agent = request(app);

const recommend = (token, industry) =>
  agent
    .post('/api/gemini/carbon-recommendations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      industry,
      emissions_data: {
        total_emissions_tons_co2e: 40,
        carbon_rating: 'B',
        breakdown: { power: 30, transportation: 10 },
      },
      selected_sectors: ['power'],
    });

describe('carbon recommendations without a Gemini key', () => {
  let token;

  beforeAll(async () => {
    const res = await agent
      .post('/api/auth/signup')
      .send({ email: 'recs@example.com', password: 'StrongPass1!', name: 'Rec User' });
    token = res.body.token;
  });

  it.each(['Technology', 'Retail'])(
    'returns fallback recommendations the page can render (%s)',
    async (industry) => {
      const res = await recommend(token, industry);

      expect(res.status).toBe(200);
      expect(res.body.summary.source).toBe('Enhanced Fallback');
      expect(res.body.recommendations.length).toBeGreaterThan(0);
      for (const rec of res.body.recommendations) {
        expect(typeof rec.title).toBe('string');
        expect(typeof rec.impact).toBe('number');
        expect(typeof rec.timeline).toBe('string');
        expect(typeof rec.cost).toBe('string');
      }
      const totalImpact = res.body.recommendations.reduce((sum, rec) => sum + rec.impact, 0);
      expect(res.body.summary.total_potential_reduction).toBeCloseTo(totalImpact);
    }
  );

  it('no longer exposes the removed ML routes', async () => {
    const res = await agent
      .get('/api/ml/model-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});
