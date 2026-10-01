/**
 * Emissions report for a range of months: the data behind the Report page
 * and its CSV download. Emissions per activity use the same factors as the
 * score, so the report always agrees with the dashboard.
 */
import { CATEGORY_LABELS, EMISSION_FACTORS, factorFor } from '../config/emissionFactors.js';
import { calculateCarbonScore } from './carbonScore.js';

export const METHODOLOGY = 'Emissions are estimated as activity amount x emission factor, in metric tonnes CO2e (AR5 GWPs). '
  + 'Factors come from the EPA GHG Emission Factors Hub (2025); grid electricity uses the state rate from EPA eGRID2023; '
  + 'a few factors without an authoritative US default are indicative. Figures are estimates for management use, not audited '
  + 'or verified values. Full methodology and sources: the Methodology page in CarbonCTRL.';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const round = (value, places = 4) => Math.round(value * 10 ** places) / 10 ** places;

/** YYYY-MM shifted from `month` by `delta` months. */
function shiftMonth(month, delta) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * Validate a from/to month range, defaulting to the last 12 months.
 * Returns `{ from, to }` or `{ error }`.
 */
export function parseReportRange({ from, to }, now = new Date()) {
  const currentMonth = now.toISOString().slice(0, 7);
  const end = to ?? currentMonth;
  // Checked before the default start is derived from it: shiftMonth throws on a malformed month
  if (!MONTH.test(end)) {
    return { error: 'from and to must be months in YYYY-MM format' };
  }
  const start = from ?? shiftMonth(end, -11);
  if (!MONTH.test(start)) {
    return { error: 'from and to must be months in YYYY-MM format' };
  }
  if (start > end) {
    return { error: 'from must not be after to' };
  }
  return { from: start, to: end };
}

export function buildReport({ profile, activities, actions, from, to }) {
  const inRange = activities
    .filter((a) => a.activityDate && a.activityDate.slice(0, 7) >= from && a.activityDate.slice(0, 7) <= to)
    .sort((a, b) => a.activityDate.localeCompare(b.activityDate));

  const score = calculateCarbonScore(
    inRange.map((a) => ({ sector: a.sector, subsector: a.subsector, amount: a.activityAmount, date: a.activityDate })),
    profile
  );

  const rows = inRange.map((a) => {
    const factor = factorFor(a.sector, a.subsector, { state: profile?.state }) ?? 0;
    const item = EMISSION_FACTORS[a.sector]?.[a.subsector];
    return {
      date: a.activityDate,
      category: CATEGORY_LABELS[a.sector] ?? a.sector,
      activity: item?.label ?? a.subsector,
      amount: a.activityAmount,
      unit: item?.unit ?? a.activityUnit,
      // Six significant figures keeps small per-unit factors readable in the CSV
      factor: Number(factor.toPrecision(6)),
      emissions: round(a.activityAmount * factor),
    };
  });

  return {
    company: profile
      ? { name: profile.name, industry: profile.industry, location: profile.location, state: profile.state, employees: profile.employeeCount ?? profile.employees }
      : null,
    period: { from, to },
    score,
    categories: Object.entries(score.emissions_breakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([sector, tonnes]) => ({ sector, label: CATEGORY_LABELS[sector] ?? sector, tonnes })),
    rows,
    actions: actions
      .filter((a) => a.status !== 'dismissed')
      .map(({ title, status, annualImpact, sector, cost }) => ({ title, status, annualImpact, sector, cost })),
    methodology: METHODOLOGY,
  };
}

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** One row per activity, then a total row; spreadsheet-friendly. */
export function reportToCsv(report) {
  const header = ['Date', 'Category', 'Activity', 'Amount', 'Unit', 'Emission factor (tCO2e per unit)', 'Emissions (tCO2e)'];
  const lines = [
    header,
    ...report.rows.map((r) => [r.date, r.category, r.activity, r.amount, r.unit, r.factor, r.emissions]),
    ['', '', 'Total', '', '', '', report.score.total_emissions_tons_co2e],
  ];
  return `${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
