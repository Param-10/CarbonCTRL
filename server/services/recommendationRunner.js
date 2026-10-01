/**
 * Generating and saving Gemini recommendations for a company. Used by the
 * Recommendations page (on request) and by the background refresh that runs
 * after the company's data changes.
 */
import { activitiesRepo, profilesRepo, recommendationSetsRepo } from '../db/repos.js';
import { calculateCarbonScore } from './carbonScore.js';
import { generateText } from './geminiClient.js';
import {
  RECOMMENDATION_CONFIG,
  buildRecommendationPrompt,
  buildSummary,
  generateRecommendations,
  recommendationInputFingerprint,
} from './recommendations.js';

// Upper bound for one generation, across the corrective retry, fallback
// models and the SDK's own retries, so a request never waits indefinitely.
// Pro with high thinking is thorough but can take a minute or more per call.
const DEADLINE_MS = 240000;
const DEFAULT_FOCUS_COUNT = 3;

const scoreInputs = (activities) =>
  activities.map((a) => ({ sector: a.sector, subsector: a.subsector, amount: a.activityAmount, date: a.activityDate }));

/**
 * The emissions recommendations are built from, always computed from the
 * stored activities so they match the data the saved set is fingerprinted
 * against (figures sent by a browser could be stale or made up).
 */
export function emissionsFromActivities(activities, profile) {
  const score = calculateCarbonScore(scoreInputs(activities), profile);
  return {
    total: score.total_emissions_tons_co2e,
    rating: score.carbon_rating,
    breakdown: score.emissions_breakdown,
  };
}

/**
 * Ask Gemini for recommendations and save the result. Throws when Gemini is
 * unavailable or returns nothing usable; callers decide how to fall back.
 */
export async function generateAndSaveRecommendations({ userId, profile, industry, emissions, activities, focusSectors }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const { intensity } = calculateCarbonScore(scoreInputs(activities), profile);
  const prompt = buildRecommendationPrompt({ profile, industry, emissions, activities, focusSectors, intensity });

  const signal = AbortSignal.timeout(DEADLINE_MS);
  const result = await generateRecommendations({
    generate: (contents) => generateText({ apiKey, contents, config: RECOMMENDATION_CONFIG, signal }),
    prompt,
    profile,
    emissions,
  });
  if (result.rejected.length > 0) {
    console.log(`Dropped ${result.rejected.length} recommendation(s) that didn't fit the profile:`, result.rejected);
  }

  const payload = {
    recommendations: result.recommendations,
    summary: buildSummary(result.recommendations, emissions.total, 'Gemini AI', emissions.breakdown),
    selected_sectors: focusSectors,
  };
  const saved = recommendationSetsRepo.save(userId, {
    payload,
    inputFingerprint: recommendationInputFingerprint({ profile, activities }),
  });
  return { ...payload, generated_at: saved.updatedAt, is_outdated: false };
}

/**
 * Regenerate a company's saved recommendations from its stored data if they
 * no longer match it. Returns what happened, for logging.
 */
export async function refreshSavedRecommendations(userId) {
  const profile = profilesRepo.findByUserId(userId);
  if (!profile?.industry) return 'skipped: no company profile';

  const activities = activitiesRepo.findByUserId(userId);
  if (activities.length === 0) return 'skipped: no activities';

  const saved = recommendationSetsRepo.findByUserId(userId);
  if (saved && saved.inputFingerprint === recommendationInputFingerprint({ profile, activities })) {
    return 'skipped: already up to date';
  }

  const emissions = emissionsFromActivities(activities, profile);
  if (emissions.total <= 0) return 'skipped: no emissions';

  // Keep the focus the user chose last time, if those categories still exist
  const kept = (saved?.payload?.selected_sectors ?? []).filter((s) => Object.hasOwn(emissions.breakdown, s));
  const focusSectors = kept.length > 0
    ? kept
    : Object.entries(emissions.breakdown).sort(([, a], [, b]) => b - a).slice(0, DEFAULT_FOCUS_COUNT).map(([s]) => s);

  await generateAndSaveRecommendations({ userId, profile, industry: profile.industry, emissions, activities, focusSectors });
  console.log(`Refreshed recommendations for user ${userId}`);
  return 'refreshed';
}
