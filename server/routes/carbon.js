import express from 'express';
import { actionItemsRepo, assessmentsRepo, activitiesRepo, emissionsRepo, profilesRepo, resetUserData } from '../db/repos.js';
import { buildReport, parseReportRange, reportToCsv } from '../services/report.js';
import auth from '../middleware/auth.js';
import { calculateCarbonScore } from '../services/carbonScore.js';
import { recommendationRefresh } from '../services/recommendationRefresh.js';
import { getUnitDescription, isValidCombination } from '../config/emissionFactors.js';

const router = express.Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST_ACTIVITY_DATE = '2000-01-01';

const utcDateString = (date) => date.toISOString().slice(0, 10);

/**
 * Validate an activity date (YYYY-MM-DD), defaulting to today. Dates up to
 * one day ahead of UTC are accepted so users in later time zones can record
 * "today".
 */
function parseActivityDate(value) {
  if (value === undefined || value === null || value === '') {
    return { date: utcDateString(new Date()) };
  }
  const parsed = typeof value === 'string' && ISO_DATE.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  // Round-tripping rejects impossible dates such as 2026-02-30
  if (!parsed || Number.isNaN(parsed.getTime()) || utcDateString(parsed) !== value) {
    return { error: 'Activity date must be a valid date in YYYY-MM-DD format' };
  }
  const latest = utcDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
  if (value < EARLIEST_ACTIVITY_DATE || value > latest) {
    return { error: `Activity date must be between ${EARLIEST_ACTIVITY_DATE} and today` };
  }
  return { date: value };
}

/** Get the user's current (latest active) assessment, creating one if needed. */
const getOrCreateActiveAssessment = (userId) => {
  let assessment = assessmentsRepo.findActiveByUserId(userId);
  if (!assessment) {
    assessment = assessmentsRepo.create(userId);
  }
  return assessment;
};

/**
 * Validate an activity request body (used for both create and edit).
 * Returns `{ values }` ready to store, or `{ error }` for a 400 response.
 */
function parseActivityInput(body) {
  const { sector, subsector, activityAmount, activityUnit, activityDate } = body;

  if (!sector || !subsector || activityAmount === undefined || !activityUnit) {
    return { error: 'Sector, subsector, activity amount, and activity unit are required' };
  }
  if (!isValidCombination(sector, subsector)) {
    return { error: `Unknown activity type: ${sector}/${subsector}` };
  }
  if (typeof activityAmount !== 'number' || !Number.isFinite(activityAmount) || activityAmount < 0) {
    return { error: 'Activity amount must be a non-negative number' };
  }
  const { date, error: dateError } = parseActivityDate(activityDate);
  if (dateError) {
    return { error: dateError };
  }
  return { values: { sector, subsector, activityAmount, activityUnit, activityDate: date } };
}

/**
 * Recompute an assessment's stored total, grade and per-sector emissions
 * from its activities, so stored figures never go stale after a change, and
 * queue a background refresh of the saved recommendations.
 */
function syncAssessmentScore(userId, assessmentId) {
  const activities = activitiesRepo.findByAssessmentId(assessmentId, 'asc');
  const score = calculateCarbonScore(
    activities.map((a) => ({ sector: a.sector, subsector: a.subsector, amount: a.activityAmount, date: a.activityDate })),
    profilesRepo.findByUserId(userId)
  );
  assessmentsRepo.updateById(assessmentId, {
    totalEmissions: score.total_emissions_tons_co2e,
    grade: score.carbon_rating
  });
  emissionsRepo.replaceAll(userId, [
    ...Object.entries(score.emissions_breakdown).map(([type, amount]) => ({ type, amount })),
    { type: 'total', amount: score.total_emissions_tons_co2e }
  ]);
  recommendationRefresh.schedule(userId);
}

// Get or create carbon assessment
router.get('/assessment', auth, async (req, res) => {
  try {
    const assessment = getOrCreateActiveAssessment(req.userId);
    res.json(assessment);
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Error fetching carbon assessment' });
  }
});

// Get all activities for user
router.get('/activities', auth, async (req, res) => {
  try {
    // Get current assessment
    const assessment = assessmentsRepo.findActiveByUserId(req.userId);

    if (!assessment) {
      return res.json([]);
    }

    const activities = activitiesRepo.findByAssessmentId(assessment.id, 'desc');

    res.json(activities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Error fetching carbon activities' });
  }
});

// Add carbon activity
router.post('/activity', auth, async (req, res) => {
  try {
    const { values, error: inputError } = parseActivityInput(req.body);
    if (inputError) {
      return res.status(400).json({ error: inputError });
    }

    // Get or create assessment
    const assessment = getOrCreateActiveAssessment(req.userId);

    // Create activity
    const activity = activitiesRepo.create({
      assessmentId: assessment.id,
      userId: req.userId,
      ...values
    });
    syncAssessmentScore(req.userId, assessment.id);

    res.status(201).json(activity);
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'Error adding carbon activity' });
  }
});

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Last day of a YYYY-MM month, capped at today so the date is never in the future. */
function monthEntryDate(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const today = utcDateString(new Date());
  return lastDay < today ? lastDay : today;
}

// Record one month's totals for several activity types at once ("Log a month")
router.post('/activities/month', auth, async (req, res) => {
  try {
    const { month, entries } = req.body;

    if (typeof month !== 'string' || !MONTH.test(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
    }
    if (month < EARLIEST_ACTIVITY_DATE.slice(0, 7) || month > utcDateString(new Date()).slice(0, 7)) {
      return res.status(400).json({ error: 'Month must be between 2000-01 and the current month' });
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Entries must be a non-empty list' });
    }

    const seen = new Set();
    const values = [];
    for (const entry of entries) {
      const { sector, subsector, activityAmount } = entry ?? {};
      if (!isValidCombination(sector, subsector)) {
        return res.status(400).json({ error: `Unknown activity type: ${sector}/${subsector}` });
      }
      if (typeof activityAmount !== 'number' || !Number.isFinite(activityAmount) || activityAmount < 0) {
        return res.status(400).json({ error: `Amount for ${sector}/${subsector} must be a non-negative number` });
      }
      const key = `${sector}/${subsector}`;
      if (seen.has(key)) {
        return res.status(400).json({ error: `${key} appears more than once` });
      }
      seen.add(key);
      values.push({ sector, subsector, activityAmount, activityUnit: getUnitDescription(sector, subsector) });
    }

    const assessment = getOrCreateActiveAssessment(req.userId);
    const activities = activitiesRepo.replaceMonthTotals({
      assessmentId: assessment.id,
      userId: req.userId,
      month,
      activityDate: monthEntryDate(month),
      entries: values
    });
    syncAssessmentScore(req.userId, assessment.id);

    res.status(201).json({ month, activities });
  } catch (error) {
    console.error('Log month error:', error);
    res.status(500).json({ error: 'Error saving monthly activities' });
  }
});

// Edit carbon activity
router.put('/activity/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid activity id' });
    }

    const { values, error: inputError } = parseActivityInput(req.body);
    if (inputError) {
      return res.status(400).json({ error: inputError });
    }

    const activity = activitiesRepo.updateByIdAndUser(id, req.userId, values);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    syncAssessmentScore(req.userId, activity.assessmentId);

    res.json(activity);
  } catch (error) {
    console.error('Edit activity error:', error);
    res.status(500).json({ error: 'Error updating carbon activity' });
  }
});

// Delete carbon activity
router.delete('/activity/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid activity id' });
    }

    const activity = activitiesRepo.findByIdAndUser(id, req.userId);
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    activitiesRepo.deleteByIdAndUser(id, req.userId);
    syncAssessmentScore(req.userId, activity.assessmentId);

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Error deleting carbon activity' });
  }
});

// Get emissions data
router.get('/emissions', auth, async (req, res) => {
  try {
    const emissions = emissionsRepo.findNonTotalByUserId(req.userId, 'desc');
    res.json(emissions);
  } catch (error) {
    console.error('Get emissions error:', error);
    res.status(500).json({ error: 'Error fetching emissions data' });
  }
});

// Reset all carbon data
router.delete('/reset', auth, async (req, res) => {
  try {
    resetUserData(req.userId);
    recommendationRefresh.cancel(req.userId);
    res.json({ message: 'All carbon data reset successfully' });
  } catch (error) {
    console.error('Reset carbon data error:', error);
    res.status(500).json({ error: 'Error resetting carbon data' });
  }
});

// Get saved carbon data (load all user data)
router.get('/saved-data', auth, async (req, res) => {
  try {
    // Get latest assessment
    const assessment = assessmentsRepo.findLatestByUserId(req.userId);

    if (!assessment) {
      return res.json({
        assessment: null,
        activities: [],
        emissions: []
      });
    }

    // Get activities for this assessment
    const activities = activitiesRepo.findByAssessmentId(assessment.id, 'asc');

    // Get emissions data
    const emissions = emissionsRepo.findNonTotalByUserId(req.userId, 'asc');

    // Recomputed from the stored activities rather than read from the saved
    // assessment, so totals always reflect the current emission factors.
    const score = activities.length > 0
      ? calculateCarbonScore(activities.map((activity) => ({
          sector: activity.sector,
          subsector: activity.subsector,
          amount: activity.activityAmount,
          date: activity.activityDate
        })), profilesRepo.findByUserId(req.userId))
      : null;

    res.json({
      assessment,
      activities,
      emissions,
      score
    });
  } catch (error) {
    console.error('Get saved data error:', error);
    res.status(500).json({ error: 'Error fetching saved carbon data' });
  }
});

/** Build the report for the requested months, or send a 400 and return null. */
function reportFor(req, res) {
  const range = parseReportRange({ from: req.query.from, to: req.query.to });
  if (range.error) {
    res.status(400).json({ error: range.error });
    return null;
  }
  return buildReport({
    profile: profilesRepo.findByUserId(req.userId),
    activities: activitiesRepo.findByUserId(req.userId),
    actions: actionItemsRepo.findByUserId(req.userId),
    ...range
  });
}

// Emissions report for a range of months (default: the last 12)
router.get('/report', auth, async (req, res) => {
  try {
    const report = reportFor(req, res);
    if (report) res.json(report);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Error building the report' });
  }
});

router.get('/report.csv', auth, async (req, res) => {
  try {
    const report = reportFor(req, res);
    if (!report) return;
    res
      .type('text/csv')
      .attachment(`carbonctrl-emissions-${report.period.from}-to-${report.period.to}.csv`)
      .send(reportToCsv(report));
  } catch (error) {
    console.error('Report CSV error:', error);
    res.status(500).json({ error: 'Error building the report' });
  }
});

export default router;