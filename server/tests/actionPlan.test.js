import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';
import { annualizeImpact, computeTargetProgress } from '../services/actionPlan.js';

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-actions');

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');

const agent = request(app);

describe('annualizeImpact', () => {
  it('scales an impact over the recorded period to a year', () => {
    expect(annualizeImpact(3, { start: '2026-01-15', end: '2026-03-20' })).toBe(12); // 3 months -> x4
    expect(annualizeImpact(3, { start: '2025-01-01', end: '2026-12-31' })).toBe(1.5); // 24 months -> x0.5
    expect(annualizeImpact(3, null)).toBe(3); // undated data counts as a year
  });
});

describe('computeTargetProgress', () => {
  const months = (count, total) =>
    Array.from({ length: count }, (_, i) => ({
      month: new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 7),
      total: typeof total === 'function' ? total(i) : total,
    }));
  const profile = { reductionTargetPercent: 25, reductionTargetYear: 2030 };

  it('reports only a baseline and estimates until more than 12 months are logged', () => {
    const progress = computeTargetProgress({
      emissionsByMonth: months(6, 10),
      profile,
      actions: [
        { status: 'done', annualImpact: 5 },
        { status: 'planned', annualImpact: 10 },
        { status: 'in_progress', annualImpact: 3 },
        { status: 'dismissed', annualImpact: 100 },
      ],
    });

    expect(progress.baseline).toEqual({ annual_emissions: 120, months: 6, from: '2025-01', to: '2025-06' });
    expect(progress.required_reduction).toBe(30); // 25% of 120
    expect(progress.measured).toBeNull();
    expect(progress.estimated).toEqual({ done_reduction: 5, planned_reduction: 13, coverage_percent: 60 });
    expect(progress.counts).toEqual({ planned: 1, in_progress: 1, done: 1, dismissed: 1 });
    expect(progress.target).toEqual({ percent: 25, year: 2030 });
  });

  it('measures the latest 12 months against the first 12 once there is more data', () => {
    // 10 t a month for the first year, 8 t a month afterwards
    const progress = computeTargetProgress({ emissionsByMonth: months(24, (i) => (i < 12 ? 10 : 8)), profile, actions: [] });

    expect(progress.baseline.annual_emissions).toBe(120);
    expect(progress.measured).toEqual({ current_annual_emissions: 96, reduction: 24, percent: 20 });
  });

  it('handles no target and no data', () => {
    expect(computeTargetProgress({ emissionsByMonth: months(3, 1), profile: {}, actions: [] })).toMatchObject({
      target: null,
      required_reduction: null,
      estimated: { coverage_percent: null },
    });
    expect(computeTargetProgress({ emissionsByMonth: [], profile, actions: [] })).toMatchObject({
      baseline: null,
      required_reduction: null,
    });
  });
});

describe('action plan API', () => {
  let token;
  const auth = () => `Bearer ${token}`;
  const addAction = (body) => agent.post('/api/actions').set('Authorization', auth()).send(body);

  beforeAll(async () => {
    const res = await agent
      .post('/api/auth/signup')
      .send({ email: 'planner@example.com', password: 'StrongPass1!', name: 'Plan Ner' });
    token = res.body.token;
    await agent.post('/api/company/profile').set('Authorization', auth()).send({
      name: 'Plan Co', industry: 'Retail', employees: '11-50', location: 'Denver, CO',
      reductionTargetPercent: 50, reductionTargetYear: 2030,
    });
    // Three months of data: Jan-Mar 2026, 3,000 kWh each (1.05 t a month at the US average grid rate)
    await agent.post('/api/carbon/activities/month').set('Authorization', auth())
      .send({ month: '2026-01', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 3000 }] });
    await agent.post('/api/carbon/activities/month').set('Authorization', auth())
      .send({ month: '2026-03', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 3000 }] });
  });

  it('adds a recommendation, converting its impact over the recorded period to a yearly one', async () => {
    const res = await addAction({
      title: 'Switch to LED lighting', description: 'Replace fluorescent tubes.', sector: 'electricity',
      impact: 0.6, cost: 'Low', timeline: '1-3 months', priority: 'High',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Switch to LED lighting', status: 'planned', sector: 'electricity', cost: 'Low' });
    expect(res.body.annualImpact).toBeCloseTo(2.4); // 3 months of data -> x4
  });

  it('adds a custom action with a yearly saving', async () => {
    const res = await addAction({ title: 'Staff carpool scheme', annualImpact: 1.5 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ annualImpact: 1.5, sector: null, cost: null });
  });

  it('refuses the same action twice', async () => {
    const res = await addAction({ title: 'switch to led lighting', impact: 1 });

    expect(res.status).toBe(409);
    expect(res.body.action.title).toBe('Switch to LED lighting');
  });

  it.each([
    [{}, /Title is required/],
    [{ title: 'X', sector: 'teleportation' }, /Unknown category/],
    [{ title: 'Y', impact: -1 }, /non-negative/],
    [{ title: 'Z', annualImpact: 'lots' }, /non-negative/],
  ])('rejects invalid input %o', async (body, message) => {
    const res = await addAction(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('moves an action through its statuses', async () => {
    const [custom] = (await agent.get('/api/actions').set('Authorization', auth())).body;

    const done = await agent.patch(`/api/actions/${custom._id}`).set('Authorization', auth()).send({ status: 'done' });
    expect(done.body.status).toBe('done');
    expect(done.body.completedAt).toBeTruthy();

    const reopened = await agent.patch(`/api/actions/${custom._id}`).set('Authorization', auth()).send({ status: 'in_progress' });
    expect(reopened.body.completedAt).toBeNull();

    const bad = await agent.patch(`/api/actions/${custom._id}`).set('Authorization', auth()).send({ status: 'finished' });
    expect(bad.status).toBe(400);
  });

  it('reports progress toward the target', async () => {
    const res = await agent.get('/api/actions/progress').set('Authorization', auth());

    expect(res.status).toBe(200);
    // Baseline: two logged months of 1.05 t -> 12.59 t a year; 50% target -> 6.29 t
    expect(res.body.baseline).toMatchObject({ annual_emissions: 12.59, months: 2, from: '2026-01', to: '2026-03' });
    expect(res.body.required_reduction).toBe(6.29);
    expect(res.body.estimated.planned_reduction).toBeCloseTo(3.9); // 2.4 + 1.5 (in progress)
    expect(res.body.measured).toBeNull();
  });

  it("keeps each company's plan private", async () => {
    const other = await agent
      .post('/api/auth/signup')
      .send({ email: 'other-planner@example.com', password: 'StrongPass1!', name: 'Oth Er' });
    const [action] = (await agent.get('/api/actions').set('Authorization', auth())).body;

    expect((await agent.get('/api/actions').set('Authorization', `Bearer ${other.body.token}`)).body).toEqual([]);
    const patch = await agent.patch(`/api/actions/${action._id}`).set('Authorization', `Bearer ${other.body.token}`).send({ status: 'done' });
    const remove = await agent.delete(`/api/actions/${action._id}`).set('Authorization', `Bearer ${other.body.token}`);
    expect(patch.status).toBe(404);
    expect(remove.status).toBe(404);
  });

  it('lets browsers send PATCH requests (CORS preflight)', async () => {
    // Supertest skips CORS, so check the preflight a browser sends before PATCH
    const res = await agent
      .options('/api/actions/1')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'PATCH');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
  });

  it('removes an action', async () => {
    const [action] = (await agent.get('/api/actions').set('Authorization', auth())).body;

    const res = await agent.delete(`/api/actions/${action._id}`).set('Authorization', auth());

    expect(res.status).toBe(200);
    expect((await agent.get('/api/actions').set('Authorization', auth())).body).toHaveLength(1);
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});
