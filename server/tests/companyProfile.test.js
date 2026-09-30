import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-company');

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');

const { gridFactorForState } = await import('../config/stateGridFactors.js');

const agent = request(app);

const baseProfile = {
  name: 'Acme Ltd',
  industry: 'Retail',
  employees: '11-50',
  location: 'Leeds, UK',
};

const contextFields = {
  reductionBudget: 'low',
  reductionTargetPercent: 30,
  reductionTargetYear: 2030,
  premisesOwnership: 'lease',
  renewableElectricityShare: 'partial',
  fleetSize: 4,
  fleetType: 'combustion',
  workModel: 'hybrid',
  siteCount: 2,
  existingMeasures: ['led_lighting', 'recycling_program'],
  reportingObligations: ['uk_secr'],
};

describe('company profile sustainability context', () => {
  let token;
  const saveProfile = (body) =>
    agent.post('/api/company/profile').set('Authorization', `Bearer ${token}`).send(body);
  const updateProfile = (body) =>
    agent.put('/api/company/profile').set('Authorization', `Bearer ${token}`).send(body);
  const getProfile = () =>
    agent.get('/api/company/profile').set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const res = await agent
      .post('/api/auth/signup')
      .send({ email: 'profile@example.com', password: 'StrongPass1!', name: 'Pro File' });
    token = res.body.token;
  });

  it('returns JSON null before a profile exists', async () => {
    const res = await getProfile();

    expect(res.status).toBe(200);
    expect(res.text).toBe('null');
  });

  it('saves a profile without any context fields', async () => {
    const res = await saveProfile(baseProfile);

    expect(res.status).toBe(200);
    expect(res.body.reductionBudget).toBeNull();
    expect(res.body.existingMeasures).toBeNull();
  });

  it('saves and returns every context field, with lists as arrays', async () => {
    const res = await saveProfile({ ...baseProfile, ...contextFields });
    expect(res.status).toBe(200);

    const fetched = await getProfile();
    expect(fetched.body).toMatchObject(contextFields);
  });

  it('accepts numeric strings from form inputs', async () => {
    const res = await updateProfile({ reductionTargetPercent: '45', siteCount: '3' });

    expect(res.status).toBe(200);
    expect(res.body.reductionTargetPercent).toBe(45);
    expect(res.body.siteCount).toBe(3);
  });

  it.each([
    [{ reductionBudget: 'unlimited' }, 'reductionBudget'],
    [{ premisesOwnership: 7 }, 'premisesOwnership'],
    [{ reductionTargetPercent: 0 }, 'reductionTargetPercent'],
    [{ reductionTargetPercent: 12.5 }, 'reductionTargetPercent'],
    [{ reductionTargetYear: 1999 }, 'reductionTargetYear'],
    [{ fleetSize: -1 }, 'fleetSize'],
    [{ employeeCount: 0 }, 'employeeCount'],
    [{ existingMeasures: ['led_lighting', 'magic'] }, 'existingMeasures'],
    [{ reportingObligations: 'csrd' }, 'reportingObligations'],
    [{ employees: '250-500' }, 'employees'],
    [{ employees: 'lots' }, 'employees'],
    [{ state: 'ZZ' }, 'state'],
    [{ state: 'tx' }, 'state'],
  ])('rejects invalid input %o', async (fields, fieldName) => {
    const res = await saveProfile({ ...baseProfile, ...fields });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(fieldName);
  });

  it('leaves fields out of a partial update untouched and clears blank ones', async () => {
    const res = await updateProfile({ reductionBudget: 'high', reportingObligations: null, siteCount: '' });

    expect(res.status).toBe(200);
    expect(res.body.reductionBudget).toBe('high');
    expect(res.body.reportingObligations).toBeNull();
    expect(res.body.siteCount).toBeNull();
    expect(res.body.premisesOwnership).toBe('lease');
    expect(res.body.existingMeasures).toEqual(['led_lighting', 'recycling_program']);
  });

  it('drops the fleet type when the company has no vehicles', async () => {
    const res = await updateProfile({ fleetSize: 0, fleetType: 'electric' });

    expect(res.status).toBe(200);
    expect(res.body.fleetSize).toBe(0);
    expect(res.body.fleetType).toBeNull();
  });

  it('saves an exact headcount', async () => {
    const res = await updateProfile({ employeeCount: 23 });

    expect(res.status).toBe(200);
    expect(res.body.employeeCount).toBe(23);
  });

  it('saves the US state that sets the grid electricity factor', async () => {
    const res = await updateProfile({ state: 'TX' });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe('TX');
    // The factor shown when adding an activity matches the one the score uses
    const catalog = await agent.get('/api/gemini/emission-factors').set('Authorization', `Bearer ${token}`);
    expect(catalog.body.emission_factors.electricity['grid-electricity'].factor).toBe(gridFactorForState('TX'));
    expect((await updateProfile({ state: '' })).body.state).toBeNull();
  });

  it('removes duplicate list entries', async () => {
    const res = await updateProfile({ existingMeasures: ['ev_fleet', 'ev_fleet'] });

    expect(res.body.existingMeasures).toEqual(['ev_fleet']);
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});
