import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-reminders');

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');
const { runMonthlyReminders, previousMonthOf } = await import('../services/monthlyReminders.js');
const { reportToCsv } = await import('../services/report.js');

const agent = request(app);

const signUp = async (email) =>
  (await agent.post('/api/auth/signup').send({ email, password: 'StrongPass1!', name: email.split('@')[0] })).body.token;
const withAuth = (token) => ({ Authorization: `Bearer ${token}` });
const createProfile = (token) =>
  agent.post('/api/company/profile').set(withAuth(token)).send({ name: 'Co', industry: 'Retail', employees: '1-10', location: 'Boise, ID', state: 'ID' });
const logMonth = (token, month, amount = 1000) =>
  agent.post('/api/carbon/activities/month').set(withAuth(token))
    .send({ month, entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount: amount }] });

describe('reminder settings', () => {
  let token;
  beforeAll(async () => {
    token = await signUp('settings@example.com');
  });

  it('are off by default and can be turned on', async () => {
    expect((await agent.get('/api/reminders/settings').set(withAuth(token))).body).toMatchObject({ monthlyReminders: false });

    const res = await agent.put('/api/reminders/settings').set(withAuth(token)).send({ monthlyReminders: true });
    expect(res.status).toBe(200);
    expect(res.body.monthlyReminders).toBe(true);
    expect((await agent.get('/api/reminders/settings').set(withAuth(token))).body.monthlyReminders).toBe(true);
  });

  it('reject a non-boolean value', async () => {
    const res = await agent.put('/api/reminders/settings').set(withAuth(token)).send({ monthlyReminders: 'yes' });
    expect(res.status).toBe(400);
  });
});

describe('monthly reminder emails', () => {
  const now = new Date(Date.UTC(2026, 8, 10)); // 10 Sep 2026 -> remind about August
  const send = vi.fn(async () => {});
  let due; let loggedAugust; let optedOut; let noProfile;

  beforeAll(async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.RESET_FROM_EMAIL = 'hello@carbonctrl.test';

    due = await signUp('due@example.com');
    loggedAugust = await signUp('logged@example.com');
    optedOut = await signUp('optedout@example.com');
    noProfile = await signUp('noprofile@example.com');
    for (const token of [due, loggedAugust, optedOut]) await createProfile(token);
    await logMonth(loggedAugust, '2026-08');
    for (const token of [due, loggedAugust, noProfile]) {
      await agent.put('/api/reminders/settings').set(withAuth(token)).send({ monthlyReminders: true });
    }
  });

  afterEach(() => send.mockClear());

  afterAll(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESET_FROM_EMAIL;
  });

  it('knows which month to ask about', () => {
    expect(previousMonthOf(now)).toBe('2026-08');
    expect(previousMonthOf(new Date(Date.UTC(2026, 0, 7)))).toBe('2025-12');
  });

  it("emails only opted-in companies that haven't logged last month", async () => {
    await runMonthlyReminders({ now, send });

    // settings@example.com also opted in (above) but has no company profile
    expect(send.mock.calls.map(([args]) => args)).toEqual([{ to: 'due@example.com', name: 'due', month: '2026-08' }]);
  });

  it('sends at most one reminder per month', async () => {
    await runMonthlyReminders({ now, send });
    expect(send).not.toHaveBeenCalled();
  });

  it('waits until the 5th of the month', async () => {
    await runMonthlyReminders({ now: new Date(Date.UTC(2026, 9, 3)), send });
    expect(send).not.toHaveBeenCalled();
  });

  it('retries next time when sending fails', async () => {
    const failing = vi.fn(async () => {
      throw new Error('provider down');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const october = new Date(Date.UTC(2026, 9, 6));

    await runMonthlyReminders({ now: october, send: failing });
    await runMonthlyReminders({ now: october, send });

    expect(failing).toHaveBeenCalled();
    expect(send.mock.calls.map(([args]) => args.to)).toContain('due@example.com');
  });

  it('does nothing when email is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    await runMonthlyReminders({ now: new Date(Date.UTC(2026, 10, 9)), send });
    process.env.RESEND_API_KEY = 'test-resend-key';

    expect(send).not.toHaveBeenCalled();
  });
});

describe('emissions report', () => {
  let token;
  beforeAll(async () => {
    token = await signUp('report@example.com');
    await createProfile(token);
    await logMonth(token, '2026-01', 1000);
    await logMonth(token, '2026-02', 2000);
    await logMonth(token, '2026-06', 4000);
    await agent.post('/api/actions').set(withAuth(token)).send({ title: 'Solar, "maybe" later', annualImpact: 2 });
  });

  it('covers only the requested months', async () => {
    const res = await agent.get('/api/carbon/report?from=2026-01&to=2026-02').set(withAuth(token));

    expect(res.status).toBe(200);
    expect(res.body.period).toEqual({ from: '2026-01', to: '2026-02' });
    expect(res.body.rows.map((r) => [r.date, r.amount])).toEqual([['2026-01-31', 1000], ['2026-02-28', 2000]]);
    expect(res.body.rows[0]).toMatchObject({ category: 'Electricity', activity: 'Electricity from the grid', unit: 'kWh', emissions: 0.1424 });
    // Idaho's grid (eGRID2023: 313.9 lb/MWh), not the US average
    expect(res.body.score.total_emissions_tons_co2e).toBeCloseTo(0.4271);
    expect(res.body.company).toMatchObject({ name: 'Co', industry: 'Retail' });
    expect(res.body.actions).toEqual([expect.objectContaining({ title: 'Solar, "maybe" later', status: 'planned' })]);
    expect(res.body.methodology).toMatch(/EPA/);
  });

  it('defaults to the last 12 months', async () => {
    const res = await agent.get('/api/carbon/report').set(withAuth(token));

    expect(res.status).toBe(200);
    expect(res.body.period.to).toBe(new Date().toISOString().slice(0, 7));
  });

  it.each([
    ['from=2026-13'],
    ['from=2026-06&to=2026-01'],
  ])('rejects an invalid range (%s)', async (query) => {
    const res = await agent.get(`/api/carbon/report?${query}`).set(withAuth(token));
    expect(res.status).toBe(400);
  });

  it('downloads as CSV', async () => {
    const res = await agent.get('/api/carbon/report.csv?from=2026-01&to=2026-06').set(withAuth(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/carbonctrl-emissions-2026-01-to-2026-06\.csv/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Category,Activity,Amount,Unit,Emission factor (tCO2e per unit),Emissions (tCO2e)');
    expect(lines[1]).toBe('2026-01-31,Electricity,Electricity from the grid,1000,kWh,0.000142383,0.1424');
    expect(lines.at(-1)).toBe(',,Total,,,,0.996679');
  });

  it('escapes commas and quotes in CSV cells', () => {
    const csv = reportToCsv({
      rows: [{ date: '2026-01-01', category: 'Waste', activity: 'Bins, "large"', amount: 1, unit: 'lbs', factor: 0.1, emissions: 0.1 }],
      score: { total_emissions_tons_co2e: 0.1 },
    });
    expect(csv.split('\r\n')[1]).toBe('2026-01-01,Waste,"Bins, ""large""",1,lbs,0.1,0.1');
  });
});

afterAll(() => {
  sqlite.close();
  cleanUpDb(dbPath);
});
