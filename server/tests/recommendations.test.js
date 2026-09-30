import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// Replace only the Gemini client; Type etc. come from the real SDK.
const gemini = vi.hoisted(() => ({
  generateContent: null,
  clientOptions: null,
}));

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal();
  class GoogleGenAI {
    constructor(options) {
      gemini.clientOptions = options;
      this.models = { generateContent: (request) => gemini.generateContent(request) };
    }
  }
  return { ...actual, GoogleGenAI };
});

// DATABASE_PATH must be set before the app/db modules are evaluated.
const dbPath = setTempDb('carbonctrl-recommendations');

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');
const { refreshSavedRecommendations } = await import('../services/recommendationRunner.js');
const { recommendationRefresh } = await import('../services/recommendationRefresh.js');
const { resetModelCooldowns } = await import('../services/geminiClient.js');

const agent = request(app);

const emissionsData = {
  total_emissions_tons_co2e: 40,
  carbon_rating: 'B',
  breakdown: { electricity: 30, business_travel: 10 },
};

const geminiReturns = (payload) => {
  gemini.generateContent = vi.fn(async () => ({
    text: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }));
};

const validRecommendation = (overrides = {}) => ({
  title: 'Switch to a green electricity tariff',
  description: 'Move the office supply to a certified renewable tariff. Compare suppliers and switch at contract renewal.',
  sector: 'electricity',
  impact: 12,
  timeline: '1-3 months',
  timeline_months: 3,
  cost: 'Low',
  roi_months: null,
  priority: 'High',
  industry_specific: 'Retail stores have steady daytime electricity use.',
  requires_owned_premises: false,
  requires_vehicle_fleet: false,
  changes_electricity_supply: true,
  targets_commuting: false,
  existing_measure: 'none',
  extends_existing_measure: false,
  ...overrides,
});

// Returns each payload in turn, one per Gemini call
const geminiReturnsSequence = (...payloads) => {
  const queue = [...payloads];
  gemini.generateContent = vi.fn(async () => ({ text: JSON.stringify(queue.shift()) }));
};

describe('carbon recommendations', () => {
  let token;

  const recommend = (body = {}) =>
    agent
      .post('/api/gemini/carbon-recommendations')
      .set('Authorization', `Bearer ${token}`)
      .send({ industry: 'Retail', emissions_data: emissionsData, selected_sectors: ['electricity'], ...body });

  const saveProfile = (body) =>
    agent.post('/api/company/profile').set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    const res = await agent
      .post('/api/auth/signup')
      .send({ email: 'recs@example.com', password: 'StrongPass1!', name: 'Rec User' });
    token = res.body.token;
  });

  describe('without a Gemini key', () => {
    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it.each(['Technology', 'Retail'])(
      'returns fallback recommendations the page can render (%s)',
      async (industry) => {
        const res = await recommend({ industry });

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
        expect(res.body.notice).toMatch(/no Gemini API key was found/);
      }
    );

    it('no longer exposes the removed ML routes', async () => {
      const res = await agent
        .get('/api/ml/model-status')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('with Gemini', () => {
    beforeAll(async () => {
      const res = await saveProfile({
        name: 'Secret Company Name',
        industry: 'Retail',
        employees: '11-50',
        location: 'Leeds, UK',
        phone: '+44 000 000',
        email: 'contact@secret.example',
        reductionBudget: 'low',
        reductionTargetPercent: 25,
        reductionTargetYear: 2030,
        premisesOwnership: 'lease',
        renewableElectricityShare: 'none',
        fleetSize: 0,
        workModel: 'hybrid',
        existingMeasures: ['led_lighting'],
        reportingObligations: [],
      });
      expect(res.status).toBe(200);

      for (const activityDate of ['2026-03-02', '2026-01-15']) {
        const activity = await agent
          .post('/api/carbon/activity')
          .set('Authorization', `Bearer ${token}`)
          .send({ sector: 'electricity', subsector: 'grid-electricity', activityAmount: 100, activityUnit: 'kWh', activityDate });
        expect(activity.status).toBe(201);
      }
    });

    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      resetModelCooldowns();
    });

    afterAll(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('sends the profile context in the prompt and requests schema-checked JSON', async () => {
      geminiReturns({ recommendations: [validRecommendation()] });

      const res = await recommend({ industry: 'Something Else', selected_sectors: ['electricity', 'not-a-sector'] });

      expect(res.status).toBe(200);
      const request = gemini.generateContent.mock.calls[0][0];
      const prompt = request.contents;
      expect(prompt).toContain('Industry: Retail');
      expect(prompt).toContain('Budget for reduction measures: Low (under $10k)');
      expect(prompt).toContain('Premises: Leases its premises');
      expect(prompt).toContain('Company vehicles: None');
      expect(prompt).toContain('Measures already in place: LED lighting');
      expect(prompt).toContain('Reporting obligations: None');
      expect(prompt).toContain("Reduction target: 25% reduction by 2030 (about 10.00 tCO2e of the recorded period's total)");
      expect(prompt).toContain('Number of sites: Not provided');
      expect(prompt).toContain('- electricity (Electricity): 30.00 tCO2e (75.0%)');
      expect(prompt).toContain('- Electricity from the grid (electricity/grid-electricity): 200 kWh across 2 record(s)');
      expect(prompt).toContain('- Recorded period: 2026-01-15 to 2026-03-02 (3 calendar months)');
      expect(prompt).toMatch(/- Intensity: building energy \(electricity plus heating and cooling\): [\d.]+ tCO2e per employee per year \(annualized from 3 month\(s\) of activity, 30 \(estimated from range\) employees\); typical for retail stores is about 9.6 tCO2e/);
      expect(prompt).toContain('- State (sets the grid electricity factor): Not provided');
      expect(prompt).not.toContain('not-a-sector');
      expect(prompt).not.toContain('Secret Company Name');
      expect(prompt).not.toContain('+44 000 000');
      expect(prompt).not.toContain('contact@secret.example');

      expect(gemini.clientOptions.apiKey).toBe('test-gemini-key');
      expect(request.model).toBe('gemini-pro-latest');
      expect(request.config.systemInstruction).toContain('carbon management consultant');
      expect(request.config.responseMimeType).toBe('application/json');
      expect(request.config.responseSchema.properties.recommendations).toBeDefined();
      expect(request.config.httpOptions.timeout).toBeGreaterThan(0);
      expect(request.config.httpOptions.retryOptions.attempts).toBeGreaterThan(1);
      expect(request.config.thinkingConfig).toEqual({ thinkingLevel: 'high' });
      expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
      expect(request.config.responseSchema.properties.recommendations.items.required).toContain('requires_owned_premises');
    });

    it('checks every recommendation and computes the summary itself', async () => {
      geminiReturns({
        recommendations: [
          validRecommendation({ impact: 500, cost: 'low', roi_months: 8 }),
          validRecommendation({ title: 'Switch to a GREEN electricity tariff' }),
          validRecommendation({ title: 'Mystery sector action', sector: 'space', impact: 999, timeline_months: 18, roi_months: 36 }),
          validRecommendation({ title: 'Negative impact', impact: -3 }),
          validRecommendation({ title: '', description: 'No title' }),
          validRecommendation({ title: 'Business travel policy', sector: 'business_travel', impact: 4, timeline_months: 12, changes_electricity_supply: false }),
        ],
        summary: { total_potential_reduction: 99999, source: 'made up' },
      });

      const res = await recommend();

      expect(res.status).toBe(200);
      const titles = res.body.recommendations.map((rec) => rec.title);
      expect(titles).toEqual(['Switch to a green electricity tariff', 'Mystery sector action', 'Business travel policy']);

      const [tariff, mystery, fleet] = res.body.recommendations;
      expect(tariff.impact).toBe(30); // capped at the electricity sector's emissions
      expect(tariff.cost).toBe('Low');
      expect(mystery.sector).toBeNull();
      expect(mystery.impact).toBe(40); // unknown sector: capped at total emissions
      expect(fleet.impact).toBe(4);
      expect(fleet.constraints).toBeUndefined(); // internal flags never reach the client

      expect(res.body.summary).toEqual({
        total_potential_reduction: 40,
        quick_wins_count: 1,
        strategic_initiatives_count: 2,
        estimated_total_investment: 'Low',
        payback_period: '8-36 months',
        source: 'Gemini AI',
      });
    });

    it('drops recommendations that conflict with the profile and retries with the reasons', async () => {
      geminiReturnsSequence(
        {
          recommendations: [
            validRecommendation({ title: 'Rooftop solar', requires_owned_premises: true }),
            validRecommendation({ title: 'Electrify the delivery vans', requires_vehicle_fleet: true, changes_electricity_supply: false }),
            validRecommendation({ title: 'Switch to LED lighting', existing_measure: 'led_lighting', changes_electricity_supply: false }),
            validRecommendation({ title: 'Smart building controls', cost: 'High', changes_electricity_supply: false }),
            validRecommendation({ title: 'Green tariff' }),
          ],
        },
        {
          recommendations: [
            validRecommendation({ title: 'Green tariff' }),
            validRecommendation({ title: 'Extend LED lighting to the second store', existing_measure: 'led_lighting', extends_existing_measure: true, changes_electricity_supply: false }),
            validRecommendation({ title: 'Ask the landlord for a green lease clause', changes_electricity_supply: false }),
          ],
        }
      );

      const res = await recommend();

      expect(res.status).toBe(200);
      expect(res.body.summary.source).toBe('Gemini AI');
      expect(res.body.recommendations.map((rec) => rec.title)).toEqual([
        'Green tariff',
        'Extend LED lighting to the second store',
        'Ask the landlord for a green lease clause',
      ]);

      expect(gemini.generateContent).toHaveBeenCalledTimes(2);
      const retryPrompt = gemini.generateContent.mock.calls[1][0].contents;
      expect(retryPrompt).toContain('"Rooftop solar": it needs owned premises but the company leases');
      expect(retryPrompt).toContain('"Electrify the delivery vans": it needs a vehicle fleet but the company has no vehicles');
      expect(retryPrompt).toContain('"Switch to LED lighting": the company already has "LED lighting"');
      expect(retryPrompt).toContain('"Smart building controls": High cost is over the Low (under $10k) budget');
    });

    it('retries once when the first reply is unusable', async () => {
      const replies = ['{"recommendations": [', JSON.stringify({
        recommendations: [
          validRecommendation({ title: 'Green tariff' }),
          validRecommendation({ title: 'Switch off idle equipment', changes_electricity_supply: false }),
          validRecommendation({ title: 'Recycling contract review', sector: 'business_travel', changes_electricity_supply: false }),
        ],
      })];
      gemini.generateContent = vi.fn(async () => ({ text: replies.shift() }));

      const res = await recommend();

      expect(res.body.summary.source).toBe('Gemini AI');
      expect(res.body.recommendations).toHaveLength(3);
      expect(gemini.generateContent.mock.calls[1][0].contents).toContain('could not be used');
    });

    describe('model fallbacks', () => {
      const quotaExceeded = Object.assign(new Error('You exceeded your current quota'), { status: 429 });
      const overloaded = Object.assign(new Error('This model is currently experiencing high demand'), { status: 503 });
      const threeRecommendations = JSON.stringify({
        recommendations: [
          validRecommendation({ title: 'Green tariff' }),
          validRecommendation({ title: 'Switch off idle equipment', changes_electricity_supply: false }),
          validRecommendation({ title: 'Travel policy', sector: 'business_travel', changes_electricity_supply: false }),
        ],
      });
      const modelsCalled = () => gemini.generateContent.mock.calls.map(([request]) => request.model);

      it('moves down the chain when models are out of quota or overloaded', async () => {
        gemini.generateContent = vi.fn(async (request) => {
          if (request.model === 'gemini-pro-latest') throw quotaExceeded;
          if (request.model !== 'gemini-3.5-flash') throw overloaded;
          return { text: threeRecommendations };
        });

        const res = await recommend();

        expect(res.body.summary.source).toBe('Gemini AI');
        expect(modelsCalled()).toEqual(['gemini-pro-latest', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash']);
      });

      it('skips a model that just ran out of quota on the next request', async () => {
        gemini.generateContent = vi.fn(async (request) => {
          if (request.model === 'gemini-pro-latest') throw quotaExceeded;
          return { text: threeRecommendations };
        });

        await recommend();
        await recommend();

        expect(modelsCalled()).toEqual(['gemini-pro-latest', 'gemini-3.8-flash', 'gemini-3.8-flash']);
      });

      it('does not try other models for errors they would share, like a rejected key', async () => {
        gemini.generateContent = vi.fn(async () => {
          throw Object.assign(new Error('API key not valid. Please pass a valid API key.'), { status: 400 });
        });

        const res = await recommend();

        expect(modelsCalled()).toEqual(['gemini-pro-latest']);
        expect(res.body.notice).toMatch(/API key on the server was rejected/);
      });
    });

    describe('saved recommendations', () => {
      const latest = () =>
        agent.get('/api/gemini/carbon-recommendations/latest').set('Authorization', `Bearer ${token}`);
      const threeRecommendations = {
        recommendations: [
          validRecommendation({ title: 'Green tariff' }),
          validRecommendation({ title: 'Switch off idle equipment', changes_electricity_supply: false }),
          validRecommendation({ title: 'Travel policy', sector: 'business_travel', changes_electricity_supply: false }),
        ],
      };

      it('saves a Gemini result and returns it as current', async () => {
        geminiReturns(threeRecommendations);
        const generated = await recommend();
        expect(generated.body.is_outdated).toBe(false);
        expect(generated.body.generated_at).toBeTruthy();

        const res = await latest();

        expect(res.status).toBe(200);
        expect(res.body.saved.recommendations.map((r) => r.title)).toEqual(['Green tariff', 'Switch off idle equipment', 'Travel policy']);
        expect(res.body.saved.selected_sectors).toEqual(['electricity']);
        expect(res.body.saved.summary.source).toBe('Gemini AI');
        expect(res.body.saved.is_outdated).toBe(false);
      });

      it('does not replace saved recommendations with a fallback set', async () => {
        gemini.generateContent = vi.fn(async () => {
          throw new Error('API key not valid');
        });
        const res = await recommend();
        expect(res.body.summary.source).toBe('Enhanced Fallback');

        expect((await latest()).body.saved.summary.source).toBe('Gemini AI');
      });

      it('flags saved recommendations as outdated when activities change', async () => {
        await agent
          .post('/api/carbon/activity')
          .set('Authorization', `Bearer ${token}`)
          .send({ sector: 'vehicles', subsector: 'car-miles', activityAmount: 500, activityUnit: 'miles', activityDate: '2026-03-05' });

        expect((await latest()).body.saved.is_outdated).toBe(true);
      });

      it('flags saved recommendations as outdated when the profile changes', async () => {
        geminiReturns(threeRecommendations);
        await recommend();
        expect((await latest()).body.saved.is_outdated).toBe(false);

        await agent.put('/api/company/profile').set('Authorization', `Bearer ${token}`).send({ reductionBudget: 'medium' });

        expect((await latest()).body.saved.is_outdated).toBe(true);
      });

      it("keeps each user's saved recommendations private", async () => {
        const other = await agent
          .post('/api/auth/signup')
          .send({ email: 'other-recs@example.com', password: 'StrongPass1!', name: 'Other User' });

        const res = await agent
          .get('/api/gemini/carbon-recommendations/latest')
          .set('Authorization', `Bearer ${other.body.token}`);

        expect(res.body).toEqual({ saved: null });
      });

      it('are removed when the user resets their carbon data', async () => {
        await agent.delete('/api/carbon/reset').set('Authorization', `Bearer ${token}`);

        expect((await latest()).body).toEqual({ saved: null });
      });
    });

    describe('background refresh', () => {
      let userId;
      const latest = () =>
        agent.get('/api/gemini/carbon-recommendations/latest').set('Authorization', `Bearer ${token}`);
      const logElectricity = (month, activityAmount) =>
        agent.post('/api/carbon/activities/month').set('Authorization', `Bearer ${token}`)
          .send({ month, entries: [{ sector: 'electricity', subsector: 'grid-electricity', activityAmount }] });

      beforeAll(async () => {
        userId = (await agent.get('/api/auth/session').set('Authorization', `Bearer ${token}`)).body.session.user.id;
        await logElectricity('2026-04', 5000);
        geminiReturns({
          recommendations: [
            validRecommendation({ title: 'Green tariff' }),
            validRecommendation({ title: 'Switch off idle equipment', changes_electricity_supply: false }),
            validRecommendation({ title: 'Heat pump study', changes_electricity_supply: false }),
          ],
        });
        await recommend();
      });

      afterAll(() => {
        recommendationRefresh.cancel(userId);
      });

      it('queues a refresh when the data changes', async () => {
        await logElectricity('2026-05', 6000);

        const saved = (await latest()).body.saved;
        expect(saved.is_outdated).toBe(true);
        expect(saved.refreshing).toBe(true);
      });

      it('regenerates outdated recommendations from the stored data', async () => {
        geminiReturns({
          recommendations: [
            validRecommendation({ title: 'Refreshed tariff' }),
            validRecommendation({ title: 'Refreshed controls', changes_electricity_supply: false }),
            validRecommendation({ title: 'Refreshed audit', changes_electricity_supply: false }),
          ],
        });

        expect(await refreshSavedRecommendations(userId)).toBe('refreshed');

        const saved = (await latest()).body.saved;
        expect(saved.is_outdated).toBe(false);
        expect(saved.recommendations.map((r) => r.title)).toEqual(['Refreshed tariff', 'Refreshed controls', 'Refreshed audit']);
        expect(saved.selected_sectors).toEqual(['electricity']);
        // Built from stored activities: 11,000 kWh over Apr-May at the US average grid rate
        expect(gemini.generateContent.mock.calls[0][0].contents).toContain('- electricity (Electricity): 3.85 tCO2e');
      });

      it('skips recommendations that are already up to date', async () => {
        expect(await refreshSavedRecommendations(userId)).toBe('skipped: already up to date');
      });

      it('keeps the queued refresh when the data changes while Gemini is working', async () => {
        const recommendations = [
          validRecommendation({ title: 'Mid-flight tariff' }),
          validRecommendation({ title: 'Mid-flight controls', changes_electricity_supply: false }),
          validRecommendation({ title: 'Mid-flight audit', changes_electricity_supply: false }),
        ];
        gemini.generateContent = vi.fn(async () => {
          // The company logs another month while the request is in flight
          await logElectricity('2026-06', 7000);
          return { text: JSON.stringify({ recommendations }) };
        });

        await recommend();

        const saved = (await latest()).body.saved;
        expect(saved.is_outdated).toBe(true);
        expect(saved.refreshing).toBe(true);
      });
    });

    it('does not repeat a failed API call itself', async () => {
      gemini.generateContent = vi.fn(async () => {
        throw new Error('API key not valid');
      });

      const res = await recommend();

      expect(res.body.summary.source).toBe('Enhanced Fallback');
      expect(gemini.generateContent).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['unparseable JSON', () => geminiReturns('not json at all')],
      ['no usable recommendations', () => geminiReturns({ recommendations: [{ title: 'Missing fields' }] })],
      ['an empty reply', () => {
        gemini.generateContent = vi.fn(async () => ({ text: undefined, candidates: [{ finishReason: 'MAX_TOKENS' }] }));
      }],
      ['an API error', () => {
        gemini.generateContent = vi.fn(async () => {
          throw new Error('quota exceeded');
        });
      }],
    ])('falls back with a notice on %s', async (_label, arrange) => {
      arrange();

      const res = await recommend();

      expect(res.status).toBe(200);
      expect(res.body.summary.source).toBe('Enhanced Fallback');
      expect(res.body.notice).toMatch(/Standard recommendations are shown instead/);
      expect(res.body.recommendations.length).toBeGreaterThan(0);
    });

    it.each([
      [Object.assign(new Error('You exceeded your current quota'), { status: 429 }), /usage limit for this API key has been reached/],
      [Object.assign(new Error('This model is currently experiencing high demand'), { status: 503 }), /Gemini is busy right now/],
      [Object.assign(new Error('models/gemini-x is not found'), { status: 404 }), /model isn't available to this API key/],
      [Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), /took too long/],
    ])('explains why Gemini failed (%s)', async (error, message) => {
      gemini.generateContent = vi.fn(async () => {
        throw error;
      });

      const res = await recommend();

      expect(res.body.notice).toMatch(message);
    });
  });

  it.each([
    [{ emissions_data: undefined }],
    [{ emissions_data: { total_emissions_tons_co2e: -1, breakdown: {} } }],
    [{ emissions_data: { total_emissions_tons_co2e: 10, breakdown: { electricity: 'lots' } } }],
    [{ emissions_data: { total_emissions_tons_co2e: 10, breakdown: [1, 2] } }],
  ])('rejects malformed emissions data %o', async (body) => {
    const res = await recommend(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/emissions_data/);
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});
