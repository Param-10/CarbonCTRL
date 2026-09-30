/**
 * Carbon reduction recommendations: prompt building, the response schema sent
 * to Gemini, and validation of what comes back.
 *
 * Gemini's output is never passed straight to the UI. Every recommendation
 * is checked and its impact capped at the emissions it could actually remove;
 * recommendations that conflict with the company profile (e.g. rooftop solar
 * for a tenant) are dropped using flags Gemini must fill in; and the summary
 * is computed here rather than taken from the model.
 */
import { createHash } from 'crypto';
import { Type } from '@google/genai';
import { CHOICE_FIELDS, MULTI_CHOICE_FIELDS, PROFILE_CONTEXT_FIELDS } from '../config/profileOptions.js';
import { CATEGORY_LABELS, EMISSION_FACTORS } from '../config/emissionFactors.js';
import { monthsSpanned } from './carbonScore.js';

export const MAX_RECOMMENDATIONS = 6;
/** Fewer usable recommendations than this triggers one corrective retry. */
export const MIN_RECOMMENDATIONS = 3;
export const QUICK_WIN_MAX_MONTHS = 6;

const COST_LEVELS = ['Low', 'Medium', 'High'];
const PRIORITY_LEVELS = ['High', 'Medium', 'Low'];
const NO_EXISTING_MEASURE = 'none';
const EXISTING_MEASURE_KEYS = Object.keys(MULTI_CHOICE_FIELDS.existingMeasures);

// Highest cost level that fits each budget (Low < $10k, Medium < $50k)
const MAX_COST_FOR_BUDGET = { low: 'Low', medium: 'Medium', high: 'High' };

export const RECOMMENDATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          sector: { type: Type.STRING },
          impact: { type: Type.NUMBER },
          timeline: { type: Type.STRING },
          timeline_months: { type: Type.INTEGER },
          cost: { type: Type.STRING, enum: COST_LEVELS },
          roi_months: { type: Type.INTEGER, nullable: true },
          priority: { type: Type.STRING, enum: PRIORITY_LEVELS },
          industry_specific: { type: Type.STRING },
          requires_owned_premises: { type: Type.BOOLEAN },
          requires_vehicle_fleet: { type: Type.BOOLEAN },
          changes_electricity_supply: { type: Type.BOOLEAN },
          targets_commuting: { type: Type.BOOLEAN },
          existing_measure: { type: Type.STRING, enum: [...EXISTING_MEASURE_KEYS, NO_EXISTING_MEASURE] },
          extends_existing_measure: { type: Type.BOOLEAN },
        },
        required: [
          'title',
          'description',
          'sector',
          'impact',
          'timeline',
          'timeline_months',
          'cost',
          'priority',
          'industry_specific',
          'requires_owned_premises',
          'requires_vehicle_fleet',
          'changes_electricity_supply',
          'targets_commuting',
          'existing_measure',
          'extends_existing_measure',
        ],
      },
    },
  },
  required: ['recommendations'],
};

export const SYSTEM_INSTRUCTION = `You are a carbon management consultant. You recommend concrete, realistic actions that reduce a company's greenhouse gas emissions, based only on the data you are given.

Rules:
- Only recommend actions this company can actually take given its context:
  - Budget: the cost level must fit the stated budget. With a Low budget, recommend mainly Low-cost actions.
  - Premises: if the company leases, do not recommend structural changes (on-site solar, replacing heating/cooling systems, insulation) unless framed as working with the landlord, e.g. a green lease clause. If it has no premises, focus on travel, IT, suppliers and home-working energy.
  - Renewable electricity: if it is already 100% renewable, do not recommend switching electricity supply.
  - Vehicles: if the company has no vehicles, do not recommend fleet changes.
  - Work model: only recommend commuting measures for on-site or hybrid companies.
  - Measures already in place: do not recommend them again. You may recommend extending them.
- Where a context item is "Not provided", do not assume it. Prefer actions that work either way.
- Each recommendation targets exactly one emissions sector. "sector" must be copied exactly from the sector keys listed in the data.
- "impact" is the estimated reduction in tonnes CO2e over the recorded period (the same period the emissions totals cover), so it is directly comparable to those totals. It must not exceed that sector's emissions. Be conservative.
- Prioritize the largest emission sources and the user's focus sectors. If a reduction target is set, rank recommendations by how much they help reach it by the target year.
- If the company has reporting obligations, say in "industry_specific" when an action supports them.
- Cost levels: Low is under $10k, Medium is $10k-$50k, High is over $50k.
- "timeline" is a readable range such as "1-3 months"; "timeline_months" is the upper end of that range in months.
- "roi_months" is the expected payback period in months, or null if the action does not pay back financially.
- "description" is 3-4 sentences with specific implementation steps.
- "industry_specific" explains why this action suits this particular company.
- Fill in these flags honestly for every recommendation; recommendations that conflict with the company's context are discarded automatically:
  - "requires_owned_premises": true if the company must own its building to do it (e.g. rooftop solar, replacing the heating system). False if a tenant can do it, including when it is framed as working with the landlord.
  - "requires_vehicle_fleet": true if it only applies to company-owned or leased vehicles.
  - "changes_electricity_supply": true if it switches where electricity comes from (renewable tariff, PPA, on-site generation).
  - "targets_commuting": true if it is mainly about how employees travel to work.
  - "existing_measure": the key of the listed measure this recommendation essentially is (${EXISTING_MEASURE_KEYS.join(', ')}), or "${NO_EXISTING_MEASURE}".
  - "extends_existing_measure": true only when the company already has that measure and this recommendation expands it (e.g. to more sites).
- Return between 4 and ${MAX_RECOMMENDATIONS} recommendations, including at least one that can be done within ${QUICK_WIN_MAX_MONTHS} months when possible.`;

/** Gemini request settings for recommendations (route and check script). */
export const RECOMMENDATION_CONFIG = {
  systemInstruction: SYSTEM_INSTRUCTION,
  // Temperature is left at the default: Gemini 3 models are tuned for it and
  // lower values can cause repetitive output. The schema and profile rules
  // keep replies consistent instead.
  // Thinking counts toward the output limit, so it is set well above what the
  // JSON reply needs; a cut-off reply can't be parsed.
  maxOutputTokens: 32768,
  // Recommendations weigh many constraints at once, so let the model reason fully
  thinkingConfig: { thinkingLevel: 'high' },
  responseMimeType: 'application/json',
  responseSchema: RECOMMENDATION_SCHEMA,
};

const NOT_PROVIDED = 'Not provided';

const label = (field, value) =>
  value === null || value === undefined ? NOT_PROVIDED : CHOICE_FIELDS[field][value] ?? value;

const labelList = (field, values) => {
  if (values === null || values === undefined) return NOT_PROVIDED;
  if (values.length === 0) return 'None';
  return values.map((value) => MULTI_CHOICE_FIELDS[field][value] ?? value).join(', ');
};

const formatTonnes = (value) => `${Number(value).toFixed(2)} tCO2e`;

function describeFleet(profile) {
  if (profile.fleetSize === null || profile.fleetSize === undefined) return NOT_PROVIDED;
  if (profile.fleetSize === 0) return 'None';
  const type = profile.fleetType ? CHOICE_FIELDS.fleetType[profile.fleetType] : 'type not provided';
  return `${profile.fleetSize} vehicles (${type})`;
}

// In the same units as the impacts Gemini returns: tonnes over the recorded period
function describeTarget(profile, totalEmissions) {
  const { reductionTargetPercent: percent, reductionTargetYear: year } = profile;
  if (!percent) return NOT_PROVIDED;
  const needed = (totalEmissions * percent) / 100;
  const byYear = year ? ` by ${year}` : '';
  return `${percent}% reduction${byYear} (about ${formatTonnes(needed)} of the recorded period's total)`;
}

/** Group activities by sector/subsector/unit so the prompt stays small. */
export function summarizeActivities(activities = []) {
  const groups = new Map();
  for (const activity of activities) {
    const key = `${activity.sector}/${activity.subsector}/${activity.activityUnit}`;
    const group = groups.get(key) ?? {
      sector: activity.sector,
      subsector: activity.subsector,
      unit: activity.activityUnit,
      amount: 0,
      count: 0,
    };
    group.amount += Number(activity.activityAmount) || 0;
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Describe the date range the recorded activities cover. */
export function describeRecordedPeriod(activities = []) {
  const dates = activities
    .map((activity) => activity.activityDate)
    .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  if (dates.length === 0) return 'Unknown (activities have no dates)';

  const start = dates[0];
  const end = dates[dates.length - 1];
  const months = monthsSpanned({ start, end });
  return `${start} to ${end} (${months} calendar month${months === 1 ? '' : 's'})`;
}

function describeIntensity(intensity) {
  if (!intensity) return NOT_PROVIDED;
  const basis = intensity.months_covered
    ? `annualized from ${intensity.months_covered} month(s) of activity`
    : 'activities undated, totals taken as a year';
  const headcount = `${intensity.employees}${intensity.employees_estimated ? ' (estimated from range)' : ''} employees`;
  const measure = intensity.basis === 'building_energy'
    ? 'building energy (electricity plus heating and cooling)'
    : 'total emissions';
  return `${measure}: ${intensity.per_employee.toFixed(2)} tCO2e per employee per year (${basis}, ${headcount}); `
    + `typical for ${intensity.benchmark_label} is about ${intensity.industry_benchmark} tCO2e, so this is ${intensity.ratio.toFixed(2)}x typical`;
}

/**
 * Build the user prompt. The company name and contact details are left out
 * on purpose: Gemini doesn't need them to recommend actions.
 */
export function buildRecommendationPrompt({ profile, industry, emissions, activities, focusSectors, intensity = null }) {
  const safeProfile = profile ?? {};
  const total = emissions.total;

  const breakdown = Object.entries(emissions.breakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([sector, amount]) => {
      const share = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';
      const label = CATEGORY_LABELS[sector] ? ` (${CATEGORY_LABELS[sector]})` : '';
      return `- ${sector}${label}: ${formatTonnes(amount)} (${share}%)`;
    })
    .join('\n');

  const activityGroups = summarizeActivities(activities);
  const activityLines = activityGroups.length > 0
    ? activityGroups
        .map((g) => {
          // Prefer the catalog's readable label and plain unit over the stored description
          const item = EMISSION_FACTORS[g.sector]?.[g.subsector];
          const name = item ? `${item.label} (${g.sector}/${g.subsector})` : `${g.sector}/${g.subsector}`;
          return `- ${name}: ${Math.round(g.amount * 100) / 100} ${item?.unit ?? g.unit} across ${g.count} record(s)`;
        })
        .join('\n')
    : '- No activities recorded';

  const description = safeProfile.description?.trim()
    ? `"""${safeProfile.description.trim()}"""`
    : NOT_PROVIDED;

  return `COMPANY
- Industry: ${industry}
- Employees: ${safeProfile.employees || NOT_PROVIDED}${safeProfile.employeeCount ? ` (exactly ${safeProfile.employeeCount})` : ''}
- Location: ${safeProfile.location || NOT_PROVIDED}
- State (sets the grid electricity factor): ${label('state', safeProfile.state)}
- Number of sites: ${safeProfile.siteCount ?? NOT_PROVIDED}
- Premises: ${label('premisesOwnership', safeProfile.premisesOwnership)}
- Work model: ${label('workModel', safeProfile.workModel)}
- Renewable share of electricity: ${label('renewableElectricityShare', safeProfile.renewableElectricityShare)}
- Company vehicles: ${describeFleet(safeProfile)}
- Budget for reduction measures: ${label('reductionBudget', safeProfile.reductionBudget)}
- Reduction target: ${describeTarget(safeProfile, total)}
- Measures already in place: ${labelList('existingMeasures', safeProfile.existingMeasures)}
- Reporting obligations: ${labelList('reportingObligations', safeProfile.reportingObligations)}
- Company description (written by the company): ${description}

EMISSIONS (current assessment)
- Recorded period: ${describeRecordedPeriod(activities)}
- Total: ${formatTonnes(total)}
- Rating: ${emissions.rating || NOT_PROVIDED}
- Intensity: ${describeIntensity(intensity)}
Sector keys and emissions:
${breakdown}

RECORDED ACTIVITIES
${activityLines}

FOCUS SECTORS CHOSEN BY THE USER
${focusSectors.length > 0 ? focusSectors.map((sector) => `- ${sector}`).join('\n') : '- None selected'}`;
}

const normalizeEnum = (value, allowed) =>
  typeof value === 'string'
    ? allowed.find((option) => option.toLowerCase() === value.trim().toLowerCase()) ?? null
    : null;

const toWholeMonths = (value) => {
  const number = Number(value);
  return value !== null && value !== '' && Number.isFinite(number) && number >= 0
    ? Math.round(number)
    : null;
};

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Check Gemini's output and keep only recommendations the UI can trust.
 * Throws when nothing usable remains so the caller can fall back.
 */
export function normalizeRecommendations(raw, emissions) {
  if (!raw || !Array.isArray(raw.recommendations)) {
    throw new Error('Response has no recommendations array');
  }

  const seenTitles = new Set();
  const normalized = [];

  for (const item of raw.recommendations) {
    if (!item || typeof item !== 'object') continue;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const description = typeof item.description === 'string' ? item.description.trim() : '';
    const impact = Number(item.impact);
    if (!title || !description || !Number.isFinite(impact) || impact < 0) continue;

    const titleKey = title.toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);

    const sector = Object.hasOwn(emissions.breakdown, item.sector) ? item.sector : null;
    const ceiling = sector ? emissions.breakdown[sector] : emissions.total;
    const roiMonths = toWholeMonths(item.roi_months);

    normalized.push({
      title,
      description,
      sector,
      impact: round2(Math.min(impact, ceiling)),
      timeline: typeof item.timeline === 'string' && item.timeline.trim() ? item.timeline.trim() : 'Not specified',
      timeline_months: toWholeMonths(item.timeline_months),
      cost: normalizeEnum(item.cost, COST_LEVELS) ?? 'Not specified',
      ...(roiMonths ? { roi_months: roiMonths } : {}),
      priority: normalizeEnum(item.priority, PRIORITY_LEVELS) ?? undefined,
      industry_specific: typeof item.industry_specific === 'string' ? item.industry_specific.trim() : undefined,
      // Internal only: used to check fit with the profile, then removed
      constraints: {
        requiresOwnedPremises: item.requires_owned_premises === true,
        requiresVehicleFleet: item.requires_vehicle_fleet === true,
        changesElectricitySupply: item.changes_electricity_supply === true,
        targetsCommuting: item.targets_commuting === true,
        existingMeasure: EXISTING_MEASURE_KEYS.includes(item.existing_measure) ? item.existing_measure : null,
        extendsExistingMeasure: item.extends_existing_measure === true,
      },
    });
  }

  if (normalized.length === 0) {
    throw new Error('No usable recommendations in response');
  }
  return normalized;
}

/** Why a recommendation doesn't fit the company, or null if it does. */
function profileConflict(rec, profile) {
  const c = rec.constraints ?? {};
  if (c.requiresOwnedPremises && profile.premisesOwnership === 'lease') {
    return 'it needs owned premises but the company leases';
  }
  if (c.requiresOwnedPremises && profile.premisesOwnership === 'none') {
    return 'it needs owned premises but the company has none';
  }
  if (c.requiresVehicleFleet && profile.fleetSize === 0) {
    return 'it needs a vehicle fleet but the company has no vehicles';
  }
  if (c.changesElectricitySupply && profile.renewableElectricityShare === 'full') {
    return 'electricity is already 100% renewable';
  }
  if (c.targetsCommuting && profile.workModel === 'remote') {
    return 'it targets commuting but the company is fully remote';
  }
  if (c.existingMeasure && !c.extendsExistingMeasure && profile.existingMeasures?.includes(c.existingMeasure)) {
    return `the company already has "${MULTI_CHOICE_FIELDS.existingMeasures[c.existingMeasure]}"`;
  }
  const maxCost = MAX_COST_FOR_BUDGET[profile.reductionBudget];
  if (maxCost && COST_LEVELS.indexOf(rec.cost) > COST_LEVELS.indexOf(maxCost)) {
    return `${rec.cost} cost is over the ${CHOICE_FIELDS.reductionBudget[profile.reductionBudget]} budget`;
  }
  return null;
}

/** Split recommendations into those that fit the profile and those that don't. */
export function enforceProfileConstraints(recommendations, profile) {
  const kept = [];
  const rejected = [];
  for (const rec of recommendations) {
    const reason = profileConflict(rec, profile ?? {});
    if (reason) {
      rejected.push({ title: rec.title, reason });
    } else {
      kept.push(rec);
    }
  }
  return { kept, rejected };
}

const withoutConstraints = (rec) =>
  Object.fromEntries(Object.entries(rec).filter(([key]) => key !== 'constraints'));

function correctionNote(rejected, keptCount) {
  const lines = rejected.map((r) => `- "${r.title}": ${r.reason}`);
  return [
    'YOUR PREVIOUS ANSWER',
    lines.length > 0
      ? `These recommendations were discarded because they don't fit this company:\n${lines.join('\n')}`
      : `It contained only ${keptCount} usable recommendation(s).`,
    `Return a complete new set of 4-${MAX_RECOMMENDATIONS} recommendations that respect every item of the company's context.`,
  ].join('\n');
}

/**
 * Ask Gemini for recommendations and keep those that fit the profile.
 *
 * `generate(contents)` returns Gemini's raw text; API errors from it are not
 * retried here (the SDK already retries transient failures). An unusable
 * reply, or one leaving fewer than MIN_RECOMMENDATIONS that fit, gets one
 * corrective retry that tells Gemini what was wrong.
 */
export async function generateRecommendations({ generate, prompt, profile, emissions, maxAttempts = 2 }) {
  let contents = prompt;
  let best = [];
  let lastError = null;
  const rejected = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const text = await generate(contents);

    let candidates;
    try {
      candidates = normalizeRecommendations(JSON.parse(text), emissions);
    } catch (error) {
      lastError = error;
      contents = `${prompt}\n\nYOUR PREVIOUS ANSWER could not be used (${error.message}). Return 4-${MAX_RECOMMENDATIONS} complete recommendations that follow the response schema.`;
      continue;
    }

    const result = enforceProfileConstraints(candidates, profile);
    rejected.push(...result.rejected);
    if (result.kept.length > best.length) best = result.kept;
    if (result.kept.length >= MIN_RECOMMENDATIONS) break;
    contents = `${prompt}\n\n${correctionNote(result.rejected, result.kept.length)}`;
  }

  if (best.length === 0) {
    throw lastError ?? new Error(`No recommendations fit the company profile (${rejected.length} rejected)`);
  }
  return { recommendations: best.slice(0, MAX_RECOMMENDATIONS).map(withoutConstraints), rejected };
}

/**
 * Hash of the data recommendations are generated from (activities and the
 * profile fields used in the prompt). Saved alongside a set; if it differs
 * later, the saved recommendations no longer reflect the company's data.
 */
export function recommendationInputFingerprint({ profile, activities }) {
  const activityKeys = (activities ?? [])
    .map((a) => [a.sector, a.subsector, a.activityAmount, a.activityDate ?? null])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const profileFields = ['industry', 'employees', 'location', 'description', ...PROFILE_CONTEXT_FIELDS];
  const profileKeys = profileFields.map((field) => [field, profile?.[field] ?? null]);
  return createHash('sha256').update(JSON.stringify({ activityKeys, profileKeys })).digest('hex');
}

/** Summary figures derived from the recommendations themselves. */
export function buildSummary(recommendations, totalEmissions, source, breakdown = null) {
  // Actions on the same sector can overlap (e.g. a green tariff and rooftop
  // solar both cut electricity emissions), so the combined reduction per
  // sector is capped at that sector's emissions, and the total at the total.
  const bySector = new Map();
  let unmatchedImpact = 0;
  for (const rec of recommendations) {
    if (rec.sector && breakdown && Object.hasOwn(breakdown, rec.sector)) {
      bySector.set(rec.sector, (bySector.get(rec.sector) ?? 0) + rec.impact);
    } else {
      unmatchedImpact += rec.impact;
    }
  }
  const combinedImpact = [...bySector].reduce(
    (sum, [sector, impact]) => sum + Math.min(impact, breakdown[sector]),
    unmatchedImpact
  );
  const quickWins = recommendations.filter(
    (rec) => rec.timeline_months !== null && rec.timeline_months <= QUICK_WIN_MAX_MONTHS
  ).length;

  const costs = COST_LEVELS.filter((level) => recommendations.some((rec) => rec.cost === level));
  const investment = costs.length === 0
    ? 'Not specified'
    : costs.length === 1 ? costs[0] : `${costs[0]} to ${costs[costs.length - 1]}`;

  const paybacks = recommendations.map((rec) => rec.roi_months).filter(Boolean);
  const minPayback = Math.min(...paybacks);
  const maxPayback = Math.max(...paybacks);
  const payback = paybacks.length === 0
    ? 'N/A'
    : minPayback === maxPayback ? `${minPayback} months` : `${minPayback}-${maxPayback} months`;

  return {
    total_potential_reduction: round2(Math.min(combinedImpact, totalEmissions)),
    quick_wins_count: quickWins,
    strategic_initiatives_count: recommendations.length - quickWins,
    estimated_total_investment: investment,
    payback_period: payback,
    source,
  };
}

/** Static recommendations used when Gemini is not configured or fails. */
export function buildFallbackRecommendations({ industry, totalEmissions }) {
  const recommendations = [];
  const industryName = industry.toLowerCase();

  if (industryName.includes('tech') || industryName.includes('software')) {
    recommendations.push({
      title: 'Carbon-Efficient Cloud and Infrastructure Optimization',
      description: 'Optimize cloud infrastructure for carbon efficiency by migrating to providers with renewable energy commitments (AWS, Google Cloud green regions). Implement automated scaling to reduce idle resource consumption and adopt sustainable coding practices to minimize computational demands.',
      sector: null,
      impact: round2(totalEmissions * 0.25),
      timeline: '3-6 months',
      timeline_months: 6,
      cost: 'Medium',
      priority: 'High',
    });
  }

  recommendations.push({
    title: 'Employee Engagement and Sustainability Training',
    description: 'Launch a comprehensive employee sustainability program including carbon literacy training, green commuting incentives, and sustainability innovation challenges. Create sustainability champions network and implement behavior change initiatives with measurable targets.',
    sector: null,
    impact: round2(totalEmissions * 0.1),
    timeline: '1-3 months',
    timeline_months: 3,
    cost: 'Low',
    priority: 'Medium',
  });

  return {
    recommendations,
    summary: buildSummary(recommendations, totalEmissions, 'Enhanced Fallback'),
  };
}
