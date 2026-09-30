import { describe, expect, it } from 'vitest';
import { calculateCarbonScore, gradeForRatio } from '../services/carbonScore.js';
import { EMISSION_FACTORS, factorFor, getEmissionFactor } from '../config/emissionFactors.js';
import { benchmarkFor } from '../config/industryBenchmarks.js';
import { STATE_GRID_LB_PER_MWH, gridFactorForState } from '../config/stateGridFactors.js';

describe('emission factors', () => {
  it('uses tonnes per US unit (kWh, therms, miles, lbs)', () => {
    // 10,000 kWh at the eGRID2023 US average (770.9 lb/MWh) is ~3.5 t, not 3,500 t
    expect(10000 * getEmissionFactor('electricity', 'grid-electricity')).toBeCloseTo(3.4967);
    // 1,000 therms of natural gas is ~5.3 t (EPA Hub 2025, table 1)
    expect(1000 * getEmissionFactor('heating_cooling', 'natural-gas')).toBeCloseTo(5.3115);
    // 10,000 miles in a company car is ~3 t (EPA Hub 2025, table 10)
    expect(10000 * getEmissionFactor('vehicles', 'car-miles')).toBeCloseTo(2.9857);
    // A short ton (2,000 lbs) of landfilled trash is ~0.58 t (EPA Hub 2025, table 9)
    expect(2000 * getEmissionFactor('waste', 'landfill')).toBeCloseTo(0.58);
  });

  it('labels every category and activity type for the UI', async () => {
    const { CATEGORY_LABELS } = await import('../config/emissionFactors.js');
    for (const [sector, subsectors] of Object.entries(EMISSION_FACTORS)) {
      expect(CATEGORY_LABELS[sector], sector).toBeTruthy();
      for (const [subsector, item] of Object.entries(subsectors)) {
        expect(item.label, `${sector}/${subsector}`).toBeTruthy();
        expect(item.unit, `${sector}/${subsector}`).toBeTruthy();
      }
    }
  });

  it('cites a source for every factor', async () => {
    const { FACTOR_SOURCES } = await import('../config/emissionFactors.js');
    for (const [sector, subsectors] of Object.entries(EMISSION_FACTORS)) {
      for (const [subsector, item] of Object.entries(subsectors)) {
        expect(FACTOR_SOURCES[item.source], `${sector}/${subsector}`).toBeTruthy();
      }
    }
  });

  it('keeps every factor positive and below 20 tCO2e per unit, except on-site renewables', () => {
    // Self-generated renewable power has no Scope 2 emissions under the GHG Protocol
    expect(getEmissionFactor('electricity', 'onsite-renewable')).toBe(0);
    for (const [sector, subsectors] of Object.entries(EMISSION_FACTORS)) {
      for (const [subsector, { factor }] of Object.entries(subsectors)) {
        if (subsector === 'onsite-renewable') continue;
        expect(factor, `${sector}/${subsector}`).toBeGreaterThan(0);
        expect(factor, `${sector}/${subsector}`).toBeLessThan(20);
      }
    }
  });
});

describe('calculateCarbonScore', () => {
  it('totals emissions by sector without floating-point noise', () => {
    const score = calculateCarbonScore([
      { sector: 'electricity', subsector: 'grid-electricity', amount: 20 },
      { sector: 'vehicles', subsector: 'car-miles', amount: 40 },
    ]);

    expect(score.total_emissions_tons_co2e).toBe(0.018936);
    expect(score.emissions_breakdown).toEqual({ electricity: 0.006993, vehicles: 0.011943 });
  });

  it('groups dated activities by month and reports the period covered', () => {
    const score = calculateCarbonScore([
      { sector: 'electricity', subsector: 'grid-electricity', amount: 1000, date: '2026-03-10' },
      { sector: 'electricity', subsector: 'grid-electricity', amount: 2000, date: '2026-01-31' },
      { sector: 'vehicles', subsector: 'car-miles', amount: 1000, date: '2026-01-05' },
      { sector: 'waste', subsector: 'landfill', amount: 1000 }, // undated: counts in totals only
    ]);

    expect(score.emissions_by_month).toEqual([
      { month: '2026-01', total: 0.997919, breakdown: { electricity: 0.699349, vehicles: 0.29857 } },
      { month: '2026-03', total: 0.349674, breakdown: { electricity: 0.349674 } },
    ]);
    expect(score.period).toEqual({ start: '2026-01-05', end: '2026-03-10' });
    expect(score.total_emissions_tons_co2e).toBeCloseTo(1.6376);
  });

  it('skips unknown activities and invalid amounts', () => {
    const score = calculateCarbonScore([
      { sector: 'electricity', subsector: 'fusion', amount: 100 },
      { sector: 'power', subsector: 'electricity-generation', amount: 100 }, // pre-migration key
      { sector: 'electricity', subsector: 'grid-electricity', amount: -5 },
      { sector: 'electricity', subsector: 'grid-electricity', amount: 'lots' },
    ]);

    expect(score.total_emissions_tons_co2e).toBe(0);
    expect(score.emissions_breakdown).toEqual({});
    expect(score.period).toBeNull();
  });

  it.each([
    [0, 'A+'],
    [0.25, 'A+'],
    [0.5, 'A'],
    [0.8, 'B'],
    [1.2, 'C'],
    [2, 'D'],
    [2.01, 'F'],
  ])('grades %sx the industry typical intensity as %s', (ratio, grade) => {
    expect(gradeForRatio(ratio)).toBe(grade);
  });
});

describe('size-aware grading', () => {
  // 3 months of electricity at the US average: 20,000 kWh x 0.00034967 = ~7 t per month
  const threeMonths = [
    { sector: 'electricity', subsector: 'grid-electricity', amount: 20000, date: '2026-01-31' },
    { sector: 'electricity', subsector: 'grid-electricity', amount: 20000, date: '2026-02-28' },
    { sector: 'electricity', subsector: 'grid-electricity', amount: 20000, date: '2026-03-31' },
  ];

  it('annualizes over the months covered and divides by the exact headcount', () => {
    const { intensity, carbon_rating, benchmark_comparison } = calculateCarbonScore(threeMonths, {
      industry: 'Technology',
      employees: '11-50',
      employeeCount: 12,
    });

    expect(intensity).toMatchObject({
      annualized_emissions: 83.921844,
      months_covered: 3,
      employees: 12,
      employees_estimated: false,
      basis: 'building_energy',
      per_employee: 6.993487,
      industry_benchmark: 3.02,
      benchmark_label: 'office buildings',
      benchmark_is_default: false,
      ratio: 2.32,
      provisional: false,
    });
    expect(carbon_rating).toBe('F');
    expect(benchmark_comparison).toBe('Above industry typical');
  });

  it('grades the same emissions better for a larger company in a heavier industry', () => {
    const { intensity, carbon_rating, benchmark_comparison } = calculateCarbonScore(threeMonths, {
      industry: 'Manufacturing',
      employees: '51-200',
    });

    expect(intensity.employees).toBe(125);
    expect(intensity.employees_estimated).toBe(true);
    expect(intensity.basis).toBe('total_indicative');
    expect(intensity.per_employee).toBeCloseTo(0.6714);
    expect(carbon_rating).toBe('A+');
    expect(benchmark_comparison).toBe('Below industry typical');
  });

  it('marks grades from less than three months of data as provisional', () => {
    const { intensity } = calculateCarbonScore(threeMonths.slice(0, 2), { industry: 'Retail', employees: '1-10' });

    expect(intensity.months_covered).toBe(2);
    expect(intensity.provisional).toBe(true);
  });

  it('treats undated totals as a year and marks them provisional', () => {
    const undated = threeMonths.map(({ date: _date, ...rest }) => rest);
    const { intensity } = calculateCarbonScore(undated, { industry: 'Retail', employees: '1-10' });

    expect(intensity.months_covered).toBeNull();
    expect(intensity.annualized_emissions).toBe(20.980461);
    expect(intensity.provisional).toBe(true);
  });

  it('uses a default benchmark for industries without one', () => {
    const { intensity } = calculateCarbonScore(threeMonths, { industry: 'Space Tourism', employees: '1-10' });

    // Unknown industries are compared with a typical office
    expect(intensity.industry_benchmark).toBe(3.02);
    expect(intensity.benchmark_label).toBe('office buildings');
    expect(intensity.benchmark_is_default).toBe(true);
  });

  it('gives no grade without a company headcount', () => {
    const score = calculateCarbonScore(threeMonths, null);

    expect(score.intensity).toBeNull();
    expect(score.carbon_rating).toBe('N/A');
    expect(score.benchmark_comparison).toMatch(/company size/);
  });
});

describe('building-energy grading', () => {
  const threeMonths = ['2026-01-31', '2026-02-28', '2026-03-31'].map((date) => ({
    sector: 'electricity',
    subsector: 'grid-electricity',
    amount: 20000,
    date,
  }));

  it('grades office-type industries on building energy, not travel', () => {
    const withTravel = [...threeMonths, { sector: 'vehicles', subsector: 'car-miles', amount: 30000, date: '2026-02-15' }];
    const { intensity } = calculateCarbonScore(withTravel, { industry: 'Technology', employeeCount: 12 });

    expect(intensity.basis).toBe('building_energy');
    expect(intensity.per_employee).toBe(6.993487);
    expect(intensity.total_per_employee).toBe(9.979187);
    expect(intensity.ratio).toBe(2.32);
  });

  it('gives no grade until electricity or heating is recorded', () => {
    const travelOnly = [{ sector: 'vehicles', subsector: 'car-miles', amount: 3000, date: '2026-01-31' }];
    const score = calculateCarbonScore(travelOnly, { industry: 'Technology', employeeCount: 12 });

    // Zero building energy would otherwise compute as an A+
    expect(score.intensity).toBeNull();
    expect(score.carbon_rating).toBe('N/A');
    expect(score.benchmark_comparison).toMatch(/electricity or heating/);
  });

  it('grades recorded on-site renewable power even though it has no emissions', () => {
    const solarOnly = threeMonths.map((a) => ({ ...a, subsector: 'onsite-renewable' }));
    const score = calculateCarbonScore(solarOnly, { industry: 'Technology', employeeCount: 12 });

    expect(score.intensity.per_employee).toBe(0);
    expect(score.carbon_rating).toBe('A+');
  });

  it('grades industrial companies on their whole footprint, travel included', () => {
    const travelOnly = [{ sector: 'vehicles', subsector: 'car-miles', amount: 3000, date: '2026-01-31' }];
    const score = calculateCarbonScore(travelOnly, { industry: 'Manufacturing', employeeCount: 12 });

    expect(score.intensity.basis).toBe('total_indicative');
    expect(score.carbon_rating).not.toBe('N/A');
  });

  it('uses the state grid for both the emissions and the benchmark', () => {
    const vermont = calculateCarbonScore(threeMonths, { industry: 'Technology', employeeCount: 12, state: 'VT' });
    const westVirginia = calculateCarbonScore(threeMonths, { industry: 'Technology', employeeCount: 12, state: 'WV' });

    expect(vermont.total_emissions_tons_co2e).toBeCloseTo(1.4207);
    expect(westVirginia.total_emissions_tons_co2e).toBeCloseTo(53.5847);
    expect(vermont.intensity).toMatchObject({ state: 'VT', industry_benchmark: 0.77, ratio: 0.62 });
    expect(westVirginia.intensity).toMatchObject({ state: 'WV', industry_benchmark: 6.77, ratio: 2.64 });
    expect(vermont.carbon_rating).toBe('B');
    expect(westVirginia.carbon_rating).toBe('F');
  });
});

describe('state grid factors', () => {
  it('covers every state, DC and Puerto Rico', () => {
    expect(Object.keys(STATE_GRID_LB_PER_MWH)).toHaveLength(52);
  });

  it('converts eGRID lb/MWh to tonnes per kWh', () => {
    // CA: 394.8 lb/MWh x 0.45359 kg/lb = 179.1 kg/MWh = 0.0001791 t/kWh
    expect(gridFactorForState('CA')).toBeCloseTo(0.0001791, 7);
  });

  it('falls back to the US average for unknown or missing states', () => {
    const us = getEmissionFactor('electricity', 'grid-electricity');
    expect(gridFactorForState('ZZ')).toBe(us);
    expect(gridFactorForState(undefined)).toBe(us);
    expect(factorFor('electricity', 'grid-electricity', { state: 'ZZ' })).toBe(us);
  });

  it('applies the state rate to grid power and the facility estimate only', () => {
    expect(factorFor('electricity', 'grid-electricity', { state: 'WV' })).toBe(gridFactorForState('WV'));
    expect(factorFor('heating_cooling', 'facility-estimate', { state: 'VT' })).toBeLessThan(
      factorFor('heating_cooling', 'facility-estimate'),
    );
    expect(factorFor('heating_cooling', 'natural-gas', { state: 'WV' })).toBe(getEmissionFactor('heating_cooling', 'natural-gas'));
  });

  it('returns null for unknown activity types', () => {
    expect(factorFor('electricity', 'fusion')).toBeNull();
  });
});

describe('industry benchmarks', () => {
  it('uses CBECS building energy for building-based industries', () => {
    expect(benchmarkFor('Retail', 'CA')).toMatchObject({ basis: 'building_energy', label: 'retail stores', isDefault: false });
    expect(benchmarkFor('Retail', 'CA').value).toBeCloseTo(5.8673);
  });

  it('keeps labeled indicative whole-footprint figures for industrial sectors', () => {
    expect(benchmarkFor('Manufacturing')).toMatchObject({ basis: 'total_indicative', value: 25, isDefault: false });
    expect(benchmarkFor('Manufacturing').source).toMatch(/Indicative/);
  });

  it('compares Other and unknown industries with an office', () => {
    expect(benchmarkFor('Other')).toMatchObject({ basis: 'building_energy', label: 'office buildings', isDefault: true });
  });
});
