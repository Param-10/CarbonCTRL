/**
 * Live check of Gemini recommendations: `npm run check:gemini`.
 *
 * Uses the real API (GEMINI_API_KEY from the environment or server/.env) and
 * the exact prompt, schema, profile rules and retry the app uses, for three
 * contrasting companies. Prints each result and flags anything that looks
 * like it ignores the company's context. Exits non-zero if a scenario fails.
 */
import '../config/nodeVersion.js';
import '../config/env.js';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODELS, generateText, isGeminiConfigured } from '../services/geminiClient.js';
import { calculateCarbonScore } from '../services/carbonScore.js';
import {
  MIN_RECOMMENDATIONS,
  RECOMMENDATION_CONFIG,
  buildRecommendationPrompt,
  generateRecommendations,
} from '../services/recommendations.js';

const activity = (sector, subsector, amount, date) => ({
  sector,
  subsector,
  activityAmount: amount,
  activityUnit: 'units',
  activityDate: date,
});

const monthly = (sector, subsector, amounts) =>
  amounts.map((amount, i) => activity(sector, subsector, amount, `2026-0${i + 1}-28`));

const SCENARIOS = [
  {
    name: 'Leased retail store, low budget, no vehicles, LED already installed',
    profile: {
      industry: 'Retail',
      employees: '11-50',
      location: 'Columbus, OH',
      state: 'OH',
      reductionBudget: 'low',
      premisesOwnership: 'lease',
      renewableElectricityShare: 'none',
      fleetSize: 0,
      workModel: 'onsite',
      existingMeasures: ['led_lighting'],
      reportingObligations: [],
    },
    activities: [
      ...monthly('heating_cooling', 'natural-gas', [310, 270, 220]),
      ...monthly('electricity', 'grid-electricity', [4200, 4000, 4600]),
      ...monthly('waste', 'landfill', [3000, 3200, 3500]),
    ],
    // Things a recommendation must not propose for this company
    forbidden: [
      { pattern: /rooftop|solar panel|install(ing)? (a )?(new )?(heat pump|hvac|boiler)|insulat/i, unless: /landlord|lease/i, reason: 'structural building change for a tenant' },
      { pattern: /fleet|electric vehicle|\bEVs?\b/i, reason: 'fleet change but the company has no vehicles' },
      { pattern: /\bLED\b/i, unless: /extend|expand|remaining|additional/i, reason: 'LED lighting is already installed' },
    ],
  },
  {
    name: 'Fully remote software company, 100% renewable, no premises',
    profile: {
      industry: 'Technology',
      employees: '51-200',
      location: 'Remote (US)',
      reductionBudget: 'medium',
      premisesOwnership: 'none',
      renewableElectricityShare: 'full',
      fleetSize: 0,
      workModel: 'remote',
      existingMeasures: ['renewable_tariff'],
      reportingObligations: ['california_sb253'],
    },
    activities: [
      ...monthly('business_travel', 'flight-medium-long', [25000, 15000, 37000]),
      ...monthly('electricity', 'grid-electricity', [3000, 3000, 3200]),
    ],
    forbidden: [
      { pattern: /rooftop|solar panel|building|office retrofit/i, reason: 'premises change but the company has none' },
      { pattern: /commut/i, reason: 'commuting change but the company is fully remote' },
      // Employees' own home supply is a separate, legitimate lever
      { pattern: /green (electricity )?tariff|renewable (electricity )?(tariff|supplier)|\bPPA\b/i, unless: /extend|already|home|employee/i, reason: 'switches to renewables but electricity is already 100% renewable' },
    ],
  },
  {
    name: 'Owner-occupied manufacturer, high budget, diesel fleet, 40% target',
    profile: {
      industry: 'Manufacturing',
      employees: '201-500',
      location: 'Ohio, USA',
      state: 'OH',
      reductionBudget: 'high',
      reductionTargetPercent: 40,
      reductionTargetYear: 2030,
      premisesOwnership: 'own',
      renewableElectricityShare: 'none',
      fleetSize: 12,
      fleetType: 'combustion',
      workModel: 'onsite',
      existingMeasures: [],
      reportingObligations: ['iso_14001'],
      siteCount: 2,
    },
    activities: [
      ...monthly('electricity', 'grid-electricity', [180000, 175000, 190000]),
      ...monthly('vehicles', 'diesel', [1900, 1800, 2050]),
      ...monthly('materials', 'steel', [44, 42, 50]),
    ],
    forbidden: [],
  },
];

function scoreFor(scenario) {
  const score = calculateCarbonScore(
    scenario.activities.map((a) => ({ sector: a.sector, subsector: a.subsector, amount: a.activityAmount, date: a.activityDate })),
    scenario.profile
  );
  return {
    score,
    emissions: {
      total: score.total_emissions_tons_co2e,
      rating: score.carbon_rating,
      breakdown: score.emissions_breakdown,
    },
  };
}

function findConflicts(recommendations, forbidden) {
  const conflicts = [];
  for (const rec of recommendations) {
    const text = `${rec.title} ${rec.description}`;
    for (const rule of forbidden) {
      if (rule.pattern.test(text) && !(rule.unless && rule.unless.test(text))) {
        conflicts.push(`"${rec.title}" may conflict: ${rule.reason}`);
      }
    }
  }
  return conflicts;
}

async function checkConnection(apiKey) {
  try {
    await generateText({
      apiKey,
      contents: 'Reply with the single word OK.',
      // Pro models can't turn thinking off, and thinking counts toward the output limit
      config: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'low' } },
    });
    console.log(`Connected to Gemini (models tried in order: ${GEMINI_MODELS.join(', ')}).\n`);
    return true;
  } catch (error) {
    console.error(`Could not call Gemini (${GEMINI_MODELS.join(', ')}): ${error.message}`);
    if (/not found|404/i.test(error.message)) {
      try {
        const pager = await new GoogleGenAI({ apiKey }).models.list();
        const names = [];
        for await (const model of pager) {
          if (/gemini/i.test(model.name ?? '') && model.supportedActions?.includes('generateContent')) {
            names.push(model.name.replace('models/', ''));
          }
        }
        console.error(`Models available to this key: ${names.join(', ') || 'none found'}`);
        console.error('Set GEMINI_MODEL (and GEMINI_FALLBACK_MODELS) in server/.env to ones from this list.');
      } catch {
        // Listing is best effort; the original error above is what matters
      }
    }
    return false;
  }
}

async function runScenario(apiKey, scenario) {
  const { emissions, score } = scoreFor(scenario);
  const prompt = buildRecommendationPrompt({
    profile: scenario.profile,
    industry: scenario.profile.industry,
    emissions,
    activities: scenario.activities,
    focusSectors: Object.keys(emissions.breakdown),
    intensity: score.intensity,
  });

  let calls = 0;
  const started = Date.now();
  const result = await generateRecommendations({
    generate: (contents) => {
      calls += 1;
      return generateText({ apiKey, contents, config: RECOMMENDATION_CONFIG, signal: AbortSignal.timeout(240000) });
    },
    prompt,
    profile: scenario.profile,
    emissions,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`  ${result.recommendations.length} recommendation(s) in ${seconds}s, ${calls} Gemini call(s)`);
  for (const rec of result.recommendations) {
    console.log(`  - [${rec.priority ?? '?'}] ${rec.title}`);
    console.log(`      sector: ${rec.sector ?? 'unmatched'} | impact: ${rec.impact} t | cost: ${rec.cost} | timeline: ${rec.timeline}`);
  }
  for (const r of result.rejected) {
    console.log(`  x dropped "${r.title}": ${r.reason}`);
  }

  const problems = [];
  if (result.recommendations.length < MIN_RECOMMENDATIONS) {
    problems.push(`only ${result.recommendations.length} recommendation(s) fit the profile`);
  }
  const unmatched = result.recommendations.filter((rec) => !rec.sector).length;
  if (unmatched > 0) problems.push(`${unmatched} recommendation(s) not tied to a recorded sector`);
  problems.push(...findConflicts(result.recommendations, scenario.forbidden));
  return problems;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!isGeminiConfigured(apiKey)) {
    console.error('GEMINI_API_KEY is not set. Add it to server/.env (or the environment) and run again.');
    process.exit(1);
  }
  if (!(await checkConnection(apiKey))) process.exit(1);

  let failed = 0;
  for (const scenario of SCENARIOS) {
    console.log(`▶ ${scenario.name}`);
    try {
      const problems = await runScenario(apiKey, scenario);
      if (problems.length === 0) {
        console.log('  PASS\n');
      } else {
        failed += 1;
        console.log(`  REVIEW:\n${problems.map((p) => `    • ${p}`).join('\n')}\n`);
      }
    } catch (error) {
      failed += 1;
      console.log(`  FAIL: ${error.message}\n`);
    }
  }

  console.log(failed === 0 ? 'All scenarios passed.' : `${failed} of ${SCENARIOS.length} scenario(s) need review.`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
