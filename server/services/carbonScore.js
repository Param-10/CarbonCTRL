/**
 * Carbon score calculation shared by the calculator endpoint and saved-data
 * loading, so both always use the current emission factors.
 *
 * The grade reflects emissions intensity (annualized tCO2e per employee)
 * relative to a typical figure for the company's industry, so a large company
 * isn't penalized for its size and a small one isn't flattered by it. For
 * building-based industries the comparison covers building energy only (see
 * config/industryBenchmarks.js); grid electricity uses the company's state.
 */
import { factorFor } from '../config/emissionFactors.js';
import { BUILDING_ENERGY_SECTORS, benchmarkFor, employeesFor } from '../config/industryBenchmarks.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Small factors (e.g. 0.00045 t per kWh) leave float noise in sums; one
// gram of precision is far below what the factors themselves can claim.
const roundTonnes = (value) => Math.round(value * 1e6) / 1e6;

// Fewer months than this make the annualized figure too uncertain to rely on
export const MIN_MONTHS_FOR_FIRM_GRADE = 3;

/** Grade bands by ratio to the industry typical; the last band has no upper limit. */
export const GRADE_BANDS = [
  { grade: 'A+', max_ratio: 0.25 },
  { grade: 'A', max_ratio: 0.5 },
  { grade: 'B', max_ratio: 0.8 },
  { grade: 'C', max_ratio: 1.2 },
  { grade: 'D', max_ratio: 2 },
  { grade: 'F', max_ratio: null },
];

/** Grade from intensity relative to the industry's typical intensity. */
export function gradeForRatio(ratio) {
  return GRADE_BANDS.find((band) => band.max_ratio === null || ratio <= band.max_ratio).grade;
}

function comparisonForRatio(ratio) {
  if (ratio < 0.8) return 'Below industry typical';
  if (ratio <= 1.2) return 'Around industry typical';
  return 'Above industry typical';
}

/** Calendar months from period.start to period.end inclusive, or null without a period. */
export const monthsSpanned = (period) => {
  if (!period) return null;
  const [startYear, startMonth] = period.start.split('-').map(Number);
  const [endYear, endMonth] = period.end.split('-').map(Number);
  return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
};

const NO_HEADCOUNT = 'Add your company size to compare with your industry';
const NO_BUILDING_ENERGY = 'Log electricity or heating to compare with similar buildings';

/**
 * Annualized emissions per employee versus the industry benchmark, or
 * `{ reason }` when there is nothing to grade: no headcount, or a
 * building-energy benchmark but no electricity or heating recorded (a zero
 * there would otherwise earn an A+).
 */
function intensityFor(total, breakdown, period, company, recordedSectors) {
  const employees = employeesFor(company);
  if (!employees) return { reason: NO_HEADCOUNT };

  const benchmark = benchmarkFor(company?.industry, company?.state);
  if (benchmark.basis === 'building_energy' && !BUILDING_ENERGY_SECTORS.some((sector) => recordedSectors.has(sector))) {
    return { reason: NO_BUILDING_ENERGY };
  }

  // Recorded totals are scaled to a year using the months the activities
  // span; undated activities are taken as already covering a year.
  const monthsCovered = monthsSpanned(period);
  const annualize = (value) => (monthsCovered ? (value * 12) / monthsCovered : value);

  // Compare like with like: building-energy benchmarks against building energy
  const gradedTotal = benchmark.basis === 'building_energy'
    ? BUILDING_ENERGY_SECTORS.reduce((sum, sector) => sum + (breakdown[sector] ?? 0), 0)
    : total;
  const perEmployee = annualize(gradedTotal) / employees.value;

  return {
    intensity: {
      annualized_emissions: roundTonnes(annualize(total)),
      months_covered: monthsCovered,
      employees: employees.value,
      employees_estimated: employees.isEstimate,
      // What the grade compares: building energy or the whole footprint
      basis: benchmark.basis,
      per_employee: roundTonnes(perEmployee),
      total_per_employee: roundTonnes(annualize(total) / employees.value),
      industry: company?.industry ?? null,
      industry_benchmark: Math.round(benchmark.value * 100) / 100,
      benchmark_label: benchmark.label,
      benchmark_source: benchmark.source,
      benchmark_is_default: benchmark.isDefault,
      state: company?.state ?? null,
      ratio: Math.round((perEmployee / benchmark.value) * 100) / 100,
      provisional: monthsCovered === null || monthsCovered < MIN_MONTHS_FOR_FIRM_GRADE,
    },
  };
}

/**
 * @param {Array<{ sector: string, subsector: string, amount: number, date?: string | null }>} activities
 *   `date` is the activity date as YYYY-MM-DD; undated activities count
 *   toward totals but not toward the monthly trend.
 * @param {{ industry?: string, employees?: string, employeeCount?: number | null, state?: string | null } | null} company
 *   The company profile; without a headcount the grade is 'N/A'. The state
 *   sets the grid electricity factor.
 */
export function calculateCarbonScore(activities, company = null) {
  let total = 0;
  const breakdown = {};
  const months = new Map();
  const skipped = [];
  const recordedSectors = new Set();
  let firstDate = null;
  let lastDate = null;

  for (const activity of activities) {
    const factor = factorFor(activity.sector, activity.subsector, { state: company?.state });
    const amount = Number(activity.amount);
    if (factor === null || !Number.isFinite(amount) || amount < 0) {
      skipped.push(`${activity.sector}/${activity.subsector}`);
      continue;
    }

    const emissions = amount * factor;
    total += emissions;
    recordedSectors.add(activity.sector);
    breakdown[activity.sector] = (breakdown[activity.sector] ?? 0) + emissions;

    if (typeof activity.date === 'string' && ISO_DATE.test(activity.date)) {
      const month = activity.date.slice(0, 7);
      const entry = months.get(month) ?? { month, total: 0, breakdown: {} };
      entry.total += emissions;
      entry.breakdown[activity.sector] = (entry.breakdown[activity.sector] ?? 0) + emissions;
      months.set(month, entry);

      if (!firstDate || activity.date < firstDate) firstDate = activity.date;
      if (!lastDate || activity.date > lastDate) lastDate = activity.date;
    }
  }

  if (skipped.length > 0) {
    console.warn(`Skipped activities with no emission factor or an invalid amount: ${[...new Set(skipped)].join(', ')}`);
  }

  const roundedTotal = roundTonnes(total);
  const roundMap = (map) =>
    Object.fromEntries(Object.entries(map).map(([key, value]) => [key, roundTonnes(value)]));
  const period = firstDate ? { start: firstDate, end: lastDate } : null;
  const { intensity = null, reason } = intensityFor(roundedTotal, breakdown, period, company, recordedSectors);

  return {
    total_emissions_tons_co2e: roundedTotal,
    carbon_rating: intensity ? gradeForRatio(intensity.ratio) : 'N/A',
    emissions_breakdown: roundMap(breakdown),
    emissions_by_month: [...months.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({ month: entry.month, total: roundTonnes(entry.total), breakdown: roundMap(entry.breakdown) })),
    period,
    intensity,
    improvement_potential: roundTonnes(Math.max(0, roundedTotal * 0.3)),
    benchmark_comparison: intensity ? comparisonForRatio(intensity.ratio) : reason
  };
}
