/**
 * Action plan maths: turning recommendation impacts into yearly figures and
 * measuring progress toward the company's reduction target.
 *
 * Progress is reported two ways and never mixed: "measured" compares recorded
 * emissions (latest 12 months vs. the first 12), and "estimated" adds up the
 * yearly savings of actions in the plan. Measured progress needs more than 12
 * months of data, so new companies see estimates first.
 */
import { monthsSpanned } from './carbonScore.js';

export const ACTION_STATUSES = ['planned', 'in_progress', 'done', 'dismissed'];
const BASELINE_MONTHS = 12;

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

/**
 * Recommendation impacts cover the recorded period; targets are yearly.
 * Undated data (no period) is taken as already covering a year.
 */
export function annualizeImpact(impact, period) {
  const months = monthsSpanned(period);
  return round(months ? (impact * 12) / months : impact, 4);
}

/** Yearly emissions from the average of the given months' totals. */
const annualFromMonths = (months) =>
  months.length === 0 ? null : (months.reduce((sum, m) => sum + m.total, 0) / months.length) * 12;

/**
 * @param {{ emissionsByMonth: Array<{month: string, total: number}>, profile: object|null, actions: Array }} input
 */
export function computeTargetProgress({ emissionsByMonth, profile, actions }) {
  const months = [...emissionsByMonth].sort((a, b) => a.month.localeCompare(b.month));
  const baselineMonths = months.slice(0, BASELINE_MONTHS);
  const baselineAnnual = annualFromMonths(baselineMonths);

  // Measured only once months beyond the baseline window are recorded;
  // then the latest 12 recorded months are compared with the first 12
  const hasLaterData = months.length > BASELINE_MONTHS;
  const currentAnnual = hasLaterData ? annualFromMonths(months.slice(-BASELINE_MONTHS)) : null;
  const measuredReduction = baselineAnnual && currentAnnual !== null ? baselineAnnual - currentAnnual : null;

  const sumImpact = (statuses) =>
    round(actions.filter((a) => statuses.includes(a.status)).reduce((sum, a) => sum + (a.annualImpact ?? 0), 0));
  const doneReduction = sumImpact(['done']);
  const plannedReduction = sumImpact(['planned', 'in_progress']);

  const targetPercent = profile?.reductionTargetPercent ?? null;
  const requiredReduction = targetPercent && baselineAnnual ? round((baselineAnnual * targetPercent) / 100) : null;

  return {
    target: targetPercent
      ? { percent: targetPercent, year: profile?.reductionTargetYear ?? null }
      : null,
    baseline: baselineAnnual === null
      ? null
      : {
          annual_emissions: round(baselineAnnual),
          months: baselineMonths.length,
          from: baselineMonths[0].month,
          to: baselineMonths[baselineMonths.length - 1].month,
        },
    required_reduction: requiredReduction,
    measured: measuredReduction === null
      ? null
      : {
          current_annual_emissions: round(currentAnnual),
          reduction: round(measuredReduction),
          percent: round((measuredReduction / baselineAnnual) * 100, 1),
        },
    estimated: {
      done_reduction: doneReduction,
      planned_reduction: plannedReduction,
      // Share of the reduction the target needs that the plan would deliver
      coverage_percent: requiredReduction
        ? round(((doneReduction + plannedReduction) / requiredReduction) * 100, 1)
        : null,
    },
    counts: Object.fromEntries(ACTION_STATUSES.map((status) => [status, actions.filter((a) => a.status === status).length])),
  };
}
