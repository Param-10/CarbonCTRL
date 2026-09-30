/**
 * Benchmarks for grading a company against its industry, per employee per
 * year.
 *
 * Building-based industries use EIA CBECS 2018 energy use per worker for the
 * matching building type (tables C14 and C24): electricity in kWh and, for
 * buildings heated with it, natural gas in cubic feet. These cover building
 * energy only, so companies in these industries are graded on building energy
 * (electricity plus heating and cooling) per employee, not their whole
 * footprint. The benchmark is converted to tCO2e with the company's own state
 * grid factor, so the comparison is with a typical business of the same type
 * in the same state.
 *
 * Industrial sectors have no comparable public per-employee dataset here, so
 * they keep indicative whole-footprint figures (tCO2e per employee per year),
 * clearly labeled as such. Keys match the industry options on the profile.
 */
import { FACTOR_SOURCES, NATURAL_GAS_T_PER_CUBIC_FOOT } from './emissionFactors.js';
import { gridFactorForState } from './stateGridFactors.js';

export const CBECS_BUILDING_TYPES = {
  office: { label: 'office buildings', kwhPerWorker: 6900, gasCubicFeetPerWorker: 11100 },
  retail: { label: 'retail stores', kwhPerWorker: 21900, gasCubicFeetPerWorker: 35700 },
  food_service: { label: 'restaurants and food service', kwhPerWorker: 21000, gasCubicFeetPerWorker: 67100 },
  lodging: { label: 'hotels and lodging', kwhPerWorker: 34900, gasCubicFeetPerWorker: 90100 },
  health_care: { label: 'health care buildings', kwhPerWorker: 14400, gasCubicFeetPerWorker: 37100 },
  education: { label: 'education buildings', kwhPerWorker: 12400, gasCubicFeetPerWorker: 43500 },
  warehouse: { label: 'warehouses and storage', kwhPerWorker: 13100, gasCubicFeetPerWorker: 42600 },
};

// Industry -> CBECS building type (graded on building energy)
const BUILDING_INDUSTRIES = {
  Technology: 'office',
  'Professional Services': 'office',
  'Financial Services': 'office',
  'Media & Entertainment': 'office',
  Telecommunications: 'office',
  Nonprofit: 'office',
  'Real Estate': 'office',
  'Government & Public Sector': 'office',
  Retail: 'retail',
  'Restaurants & Food Service': 'food_service',
  Hospitality: 'lodging',
  Healthcare: 'health_care',
  Education: 'education',
  'Wholesale & Distribution': 'warehouse',
};

// Industry -> indicative whole-footprint tCO2e per employee per year
const INDICATIVE_INDUSTRIES = {
  Construction: 15,
  'Food & Beverage Production': 20,
  Manufacturing: 25,
  Agriculture: 30,
  Transportation: 40,
  Energy: 150,
};

/** Categories that make up "building energy" for building-based industries. */
export const BUILDING_ENERGY_SECTORS = ['electricity', 'heating_cooling'];

export const EMPLOYEE_RANGE_ESTIMATES = {
  '1-10': 5,
  '11-50': 30,
  '51-200': 125,
  '201-500': 350,
  '500+': 750,
};

const buildingBenchmark = (type, state, isDefault) => {
  const building = CBECS_BUILDING_TYPES[type];
  return {
    basis: 'building_energy',
    value: building.kwhPerWorker * gridFactorForState(state) + building.gasCubicFeetPerWorker * NATURAL_GAS_T_PER_CUBIC_FOOT,
    label: building.label,
    source: FACTOR_SOURCES.cbecs_2018.title,
    isDefault,
  };
};

/**
 * Benchmark for an industry, in tCO2e per employee per year.
 * `basis` says what it compares: building energy, or the whole footprint.
 */
export function benchmarkFor(industry, state) {
  if (Object.hasOwn(BUILDING_INDUSTRIES, industry)) {
    return buildingBenchmark(BUILDING_INDUSTRIES[industry], state, false);
  }
  if (Object.hasOwn(INDICATIVE_INDUSTRIES, industry)) {
    return {
      basis: 'total_indicative',
      value: INDICATIVE_INDUSTRIES[industry],
      label: industry.toLowerCase(),
      source: FACTOR_SOURCES.indicative.title,
      isDefault: false,
    };
  }
  // "Other" and unknown industries are compared with a typical office
  return buildingBenchmark('office', state, true);
}

/** Every industry's benchmark basis, for the Methodology page. */
export function allIndustryBenchmarks(state) {
  return [...Object.keys(BUILDING_INDUSTRIES), ...Object.keys(INDICATIVE_INDUSTRIES)]
    .sort()
    .map((industry) => {
      const benchmark = benchmarkFor(industry, state);
      return { industry, ...benchmark, value: Math.round(benchmark.value * 100) / 100 };
    });
}

/** Exact headcount when given, otherwise the range estimate. */
export function employeesFor(profile) {
  if (Number.isInteger(profile?.employeeCount) && profile.employeeCount > 0) {
    return { value: profile.employeeCount, isEstimate: false };
  }
  const estimate = EMPLOYEE_RANGE_ESTIMATES[profile?.employees];
  return estimate ? { value: estimate, isEstimate: true } : null;
}
