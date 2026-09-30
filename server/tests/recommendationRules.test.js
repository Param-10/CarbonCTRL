import { describe, expect, it } from 'vitest';
import { buildSummary, enforceProfileConstraints } from '../services/recommendations.js';

const rec = (constraints = {}, cost = 'Low') => ({
  title: 'Action',
  cost,
  constraints: {
    requiresOwnedPremises: false,
    requiresVehicleFleet: false,
    changesElectricitySupply: false,
    targetsCommuting: false,
    existingMeasure: null,
    extendsExistingMeasure: false,
    ...constraints,
  },
});

const isKept = (recommendation, profile) =>
  enforceProfileConstraints([recommendation], profile).kept.length === 1;

describe('enforceProfileConstraints', () => {
  it.each([
    ['owned premises for a tenant', rec({ requiresOwnedPremises: true }), { premisesOwnership: 'lease' }],
    ['owned premises for a remote company', rec({ requiresOwnedPremises: true }), { premisesOwnership: 'none' }],
    ['fleet changes without vehicles', rec({ requiresVehicleFleet: true }), { fleetSize: 0 }],
    ['a supply switch at 100% renewable', rec({ changesElectricitySupply: true }), { renewableElectricityShare: 'full' }],
    ['commuting for a remote company', rec({ targetsCommuting: true }), { workModel: 'remote' }],
    ['a measure already in place', rec({ existingMeasure: 'led_lighting' }), { existingMeasures: ['led_lighting'] }],
    ['Medium cost on a low budget', rec({}, 'Medium'), { reductionBudget: 'low' }],
    ['High cost on a medium budget', rec({}, 'High'), { reductionBudget: 'medium' }],
  ])('drops %s', (_label, recommendation, profile) => {
    const { kept, rejected } = enforceProfileConstraints([recommendation], profile);

    expect(kept).toHaveLength(0);
    expect(rejected[0].reason).toBeTruthy();
  });

  it.each([
    ['owned premises with mixed ownership', rec({ requiresOwnedPremises: true }), { premisesOwnership: 'mixed' }],
    ['fleet changes when fleet size is unknown', rec({ requiresVehicleFleet: true }), { fleetSize: null }],
    ['a supply switch at partial renewable', rec({ changesElectricitySupply: true }), { renewableElectricityShare: 'partial' }],
    ['commuting for a hybrid company', rec({ targetsCommuting: true }), { workModel: 'hybrid' }],
    ['extending a measure already in place', rec({ existingMeasure: 'led_lighting', extendsExistingMeasure: true }), { existingMeasures: ['led_lighting'] }],
    ['a measure not yet in place', rec({ existingMeasure: 'onsite_solar' }), { existingMeasures: ['led_lighting'] }],
    ['Medium cost on a medium budget', rec({}, 'Medium'), { reductionBudget: 'medium' }],
    ['High cost when no budget is set', rec({}, 'High'), { reductionBudget: null }],
    ['anything when there is no profile', rec({ requiresOwnedPremises: true, requiresVehicleFleet: true }, 'High'), null],
  ])('keeps %s', (_label, recommendation, profile) => {
    expect(isKept(recommendation, profile)).toBe(true);
  });
});

describe('buildSummary', () => {
  const impact = (sector, value) => ({ sector, impact: value, timeline_months: 3, cost: 'Low' });

  it('caps overlapping actions on one sector at that sector\'s emissions', () => {
    // A green tariff, rooftop solar and LED retrofit all cut the same 245 t of electricity
    const summary = buildSummary(
      [impact('power', 200), impact('power', 40), impact('power', 12), impact('transportation', 4)],
      300,
      'Gemini AI',
      { power: 245, transportation: 30, manufacturing: 25 }
    );

    expect(summary.total_potential_reduction).toBe(249);
  });

  it('counts actions without a matched sector toward the total, capped at total emissions', () => {
    const summary = buildSummary([impact(null, 20), impact('power', 10)], 25, 'Gemini AI', { power: 25 });

    expect(summary.total_potential_reduction).toBe(25);
  });
});
