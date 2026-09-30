import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';
import { getEmissionFactor } from '../config/emissionFactors.js';

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-activities');

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');

const agent = request(app);

const utcDate = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('carbon activities with dates', () => {
  let token;
  const addActivity = (body) =>
    agent
      .post('/api/carbon/activity')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sector: 'electricity',
        subsector: 'grid-electricity',
        activityAmount: 1000,
        activityUnit: 'kWh of electricity used',
        ...body,
      });

  beforeAll(async () => {
    const res = await agent
      .post('/api/auth/signup')
      .send({ email: 'dates@example.com', password: 'StrongPass1!', name: 'Date User' });
    token = res.body.token;
  });

  it('stores the given activity date', async () => {
    const res = await addActivity({ activityDate: '2026-01-15' });

    expect(res.status).toBe(201);
    expect(res.body.activityDate).toBe('2026-01-15');
  });

  it("defaults the activity date to today's UTC date", async () => {
    const res = await addActivity({ activityAmount: 500 });

    expect(res.status).toBe(201);
    expect([utcDate(0), utcDate(-1)]).toContain(res.body.activityDate);
  });

  it.each([
    ['15/01/2026'],
    ['2026-02-30'],
    ['1999-12-31'],
    [20260115],
  ])('rejects the invalid date %s', async (activityDate) => {
    const res = await addActivity({ activityDate });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Activity date/);
  });

  it('rejects dates in the future', async () => {
    const res = await addActivity({ activityDate: utcDate(3) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/between/);
  });

  it('returns saved data with a score recomputed from the stored activities', async () => {
    // A stale, inflated stored total, the way older factor values produced it
    const assessment = await agent.get('/api/carbon/assessment').set('Authorization', `Bearer ${token}`);
    sqlite.prepare("UPDATE carbon_assessments SET total_emissions = 675, grade = 'F' WHERE id = ?").run(assessment.body.id);

    const res = await agent.get('/api/carbon/saved-data').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.assessment.totalEmissions).toBe(675);
    expect(res.body.score.total_emissions_tons_co2e).toBe(0.524512);
    // No company profile yet, so there is no headcount to grade against
    expect(res.body.score.carbon_rating).toBe('N/A');
    expect(res.body.score.emissions_by_month[0]).toEqual({
      month: '2026-01',
      total: 0.349674,
      breakdown: { electricity: 0.349674 },
    });
    expect(res.body.score.period.start).toBe('2026-01-15');
  });

  it('grades saved data against the company profile', async () => {
    await agent
      .post('/api/company/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dated Co', industry: 'Retail', employees: '1-10', location: 'Leeds' });

    const res = await agent.get('/api/carbon/saved-data').set('Authorization', `Bearer ${token}`);

    expect(res.body.score.intensity).toMatchObject({
      employees: 5,
      employees_estimated: true,
      basis: 'building_energy',
      benchmark_label: 'retail stores',
      industry_benchmark: 9.6,
    });
    expect(res.body.score.carbon_rating).toBe('A+');
    expect(res.body.score.benchmark_comparison).toBe('Below industry typical');
  });

  it('passes activity dates through the calculator', async () => {
    const res = await agent
      .post('/api/gemini/carbon-calculator')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company_name: 'Dated Co',
        activities: [
          { sector: 'vehicles', subsector: 'car-miles', activity_amount: 1000, activity_date: '2026-02-01' },
          { sector: 'vehicles', subsector: 'car-miles', activity_amount: 1000, activity_date: '2026-04-01' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.company_name).toBe('Dated Co');
    expect(res.body.total_emissions_tons_co2e).toBe(0.59714);
    expect(res.body.emissions_by_month.map((m) => m.month)).toEqual(['2026-02', '2026-04']);
  });

  describe('editing, deleting and keeping the stored score in sync', () => {
    let activityId;
    const storedTotals = async () => {
      const assessment = await agent.get('/api/carbon/assessment').set('Authorization', `Bearer ${token}`);
      const emissions = await agent.get('/api/carbon/emissions').set('Authorization', `Bearer ${token}`);
      return {
        total: assessment.body.totalEmissions,
        grade: assessment.body.grade,
        bySector: Object.fromEntries(emissions.body.map((e) => [e.type, e.amount])),
      };
    };

    beforeAll(async () => {
      await agent.delete('/api/carbon/reset').set('Authorization', `Bearer ${token}`);
      const res = await addActivity({ activityAmount: 2000, activityDate: '2026-02-10' });
      activityId = res.body._id;
    });

    it('updates the stored total, grade and breakdown when an activity is added', async () => {
      const totals = await storedTotals();

      expect(totals.total).toBe(0.699349);
      expect(totals.grade).not.toBe('N/A'); // the profile from an earlier test gives a headcount
      expect(totals.bySector).toEqual({ electricity: 0.699349 });
    });

    it('edits an activity and recalculates', async () => {
      const res = await agent
        .put(`/api/carbon/activity/${activityId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sector: 'vehicles',
          subsector: 'car-miles',
          activityAmount: 1000,
          activityUnit: 'miles driven in company cars',
          activityDate: '2026-02-12',
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ sector: 'vehicles', subsector: 'car-miles', activityAmount: 1000, activityDate: '2026-02-12' });
      expect(await storedTotals()).toMatchObject({ total: 0.29857, bySector: { vehicles: 0.29857 } });
    });

    it.each([
      ['an unknown activity type', { subsector: 'teleportation' }, /Unknown activity type/],
      ['a negative amount', { activityAmount: -1 }, /non-negative/],
      ['a future date', { activityDate: utcDate(5) }, /between/],
    ])('rejects an edit with %s', async (_label, change, message) => {
      const res = await agent
        .put(`/api/carbon/activity/${activityId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sector: 'vehicles', subsector: 'car-miles', activityAmount: 1000, activityUnit: 'miles', activityDate: '2026-02-12', ...change });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(message);
    });

    it('rejects unknown activity types when adding too', async () => {
      const res = await addActivity({ sector: 'electricity', subsector: 'fusion' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Unknown activity type/);
    });

    it("cannot edit or delete another user's activity", async () => {
      const other = await agent
        .post('/api/auth/signup')
        .send({ email: 'intruder@example.com', password: 'StrongPass1!', name: 'In Truder' });
      const otherAuth = `Bearer ${other.body.token}`;

      const edit = await agent
        .put(`/api/carbon/activity/${activityId}`)
        .set('Authorization', otherAuth)
        .send({ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 1, activityUnit: 'kWh' });
      const remove = await agent.delete(`/api/carbon/activity/${activityId}`).set('Authorization', otherAuth);

      expect(edit.status).toBe(404);
      expect(remove.status).toBe(404);
    });

    it('recalculates after deleting an activity', async () => {
      const res = await agent.delete(`/api/carbon/activity/${activityId}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(await storedTotals()).toMatchObject({ total: 0, bySector: {} });
    });
  });

  describe('logging a month', () => {
    let monthToken;
    const logMonth = (body) =>
      agent.post('/api/carbon/activities/month').set('Authorization', `Bearer ${monthToken}`).send(body);
    const activities = async () =>
      (await agent.get('/api/carbon/saved-data').set('Authorization', `Bearer ${monthToken}`)).body.activities;
    const ofType = (list, subsector) => list.filter((a) => a.subsector === subsector);

    beforeAll(async () => {
      const res = await agent
        .post('/api/auth/signup')
        .send({ email: 'monthly@example.com', password: 'StrongPass1!', name: 'Month Ly' });
      monthToken = res.body.token;
    });

    it('records several activity types dated at the end of the month', async () => {
      const res = await logMonth({
        month: '2026-02',
        entries: [
          { sector: 'electricity', subsector: 'grid-electricity', activityAmount: 3000 },
          { sector: 'heating_cooling', subsector: 'natural-gas', activityAmount: 200 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body.activities.map((a) => a.activityDate)).toEqual(['2026-02-28', '2026-02-28']);
      expect(res.body.activities[0].activityUnit).toMatch(/kWh/);

      const saved = await agent.get('/api/carbon/saved-data').set('Authorization', `Bearer ${monthToken}`);
      expect(saved.body.score.total_emissions_tons_co2e).toBeCloseTo(
        3000 * getEmissionFactor('electricity', 'grid-electricity') + 200 * getEmissionFactor('heating_cooling', 'natural-gas'),
      );
    });

    it('replaces the month total instead of adding a duplicate', async () => {
      // An extra electricity entry added separately in the same month...
      await agent
        .post('/api/carbon/activity')
        .set('Authorization', `Bearer ${monthToken}`)
        .send({ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 500, activityUnit: 'kWh', activityDate: '2026-02-10' });
      expect(ofType(await activities(), 'grid-electricity')).toHaveLength(2);

      // ...is merged into the single total the monthly log saves
      await logMonth({ month: '2026-02', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 3600 }] });

      const list = await activities();
      expect(ofType(list, 'grid-electricity')).toEqual([expect.objectContaining({ activityAmount: 3600, activityDate: '2026-02-28' })]);
      expect(ofType(list, 'natural-gas')).toHaveLength(1); // types not in the request are untouched
    });

    it('leaves other months alone', async () => {
      await logMonth({ month: '2026-03', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 3100 }] });

      const electricity = ofType(await activities(), 'grid-electricity').map((a) => [a.activityDate, a.activityAmount]);
      expect(electricity).toEqual(expect.arrayContaining([['2026-02-28', 3600], ['2026-03-31', 3100]]));
      expect(electricity).toHaveLength(2);
    });

    it("dates the current month's entries today rather than in the future", async () => {
      const currentMonth = utcDate(0).slice(0, 7);
      const res = await logMonth({ month: currentMonth, entries: [{ sector: 'waste', subsector: 'landfill', activityAmount: 100 }] });

      expect(res.status).toBe(201);
      expect(res.body.activities[0].activityDate <= utcDate(0)).toBe(true);
      expect(res.body.activities[0].activityDate.startsWith(currentMonth)).toBe(true);
    });

    it.each([
      ['a bad month', { month: '2026-13', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 1 }] }, /YYYY-MM/],
      ['a future month', { month: '2099-01', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 1 }] }, /current month/],
      ['no entries', { month: '2026-02', entries: [] }, /non-empty/],
      ['an unknown type', { month: '2026-02', entries: [{ sector: 'power', subsector: 'electricity-generation', activityAmount: 1 }] }, /Unknown activity type/],
      ['a negative amount', { month: '2026-02', entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: -1 }] }, /non-negative/],
      ['a repeated type', {
        month: '2026-02',
        entries: [
          { sector: 'electricity', subsector: 'grid-electricity', activityAmount: 1 },
          { sector: 'electricity', subsector: 'grid-electricity', activityAmount: 2 },
        ],
      }, /more than once/],
    ])('rejects %s', async (_label, body, message) => {
      const res = await logMonth(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(message);
    });
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});
