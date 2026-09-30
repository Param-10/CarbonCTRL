import express from 'express';
import auth from '../middleware/auth.js';
import { actionItemsRepo, activitiesRepo, profilesRepo } from '../db/repos.js';
import { calculateCarbonScore } from '../services/carbonScore.js';
import { ACTION_STATUSES, annualizeImpact, computeTargetProgress } from '../services/actionPlan.js';
import { CATEGORY_LABELS } from '../config/emissionFactors.js';

const router = express.Router();

const MAX_TITLE = 200;
const MAX_TEXT = 2000;
const COST_LEVELS = ['Low', 'Medium', 'High'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const isNonNegativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const optionalText = (value, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

function userScore(userId) {
  const activities = activitiesRepo.findByUserId(userId);
  return calculateCarbonScore(
    activities.map((a) => ({ sector: a.sector, subsector: a.subsector, amount: a.activityAmount, date: a.activityDate })),
    profilesRepo.findByUserId(userId)
  );
}

// The company's action plan, newest first
router.get('/', auth, async (req, res) => {
  try {
    res.json(actionItemsRepo.findByUserId(req.userId));
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ error: 'Error fetching your action plan' });
  }
});

// Progress toward the reduction target: measured (from data) and estimated (from the plan)
router.get('/progress', auth, async (req, res) => {
  try {
    const score = userScore(req.userId);
    res.json(computeTargetProgress({
      emissionsByMonth: score.emissions_by_month,
      profile: profilesRepo.findByUserId(req.userId),
      actions: actionItemsRepo.findByUserId(req.userId),
    }));
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Error calculating progress' });
  }
});

/**
 * Add an action. Either `impact` (tCO2e over the recorded period, as on a
 * recommendation; annualized here) or `annualImpact` (tCO2e per year, for a
 * custom action) may be given.
 */
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, sector, impact, annualImpact, cost, timeline, priority } = req.body;

    const cleanTitle = optionalText(title, MAX_TITLE);
    if (!cleanTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (sector != null && !Object.hasOwn(CATEGORY_LABELS, sector)) {
      return res.status(400).json({ error: `Unknown category: ${sector}` });
    }
    if (impact !== undefined && !isNonNegativeNumber(impact)) {
      return res.status(400).json({ error: 'Impact must be a non-negative number' });
    }
    if (annualImpact !== undefined && !isNonNegativeNumber(annualImpact)) {
      return res.status(400).json({ error: 'Annual impact must be a non-negative number' });
    }

    const existing = actionItemsRepo
      .findByUserId(req.userId)
      .find((action) => action.title.toLowerCase() === cleanTitle.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'This action is already in your plan', action: existing });
    }

    const yearly = annualImpact !== undefined
      ? annualImpact
      : impact !== undefined
        ? annualizeImpact(impact, userScore(req.userId).period)
        : 0;

    const action = actionItemsRepo.create(req.userId, {
      title: cleanTitle,
      description: optionalText(description, MAX_TEXT),
      sector: sector ?? null,
      annualImpact: yearly,
      cost: COST_LEVELS.includes(cost) ? cost : null,
      timeline: optionalText(timeline, 100),
      priority: PRIORITIES.includes(priority) ? priority : null,
      status: 'planned',
    });
    res.status(201).json(action);
  } catch (error) {
    console.error('Create action error:', error);
    res.status(500).json({ error: 'Error adding the action' });
  }
});

// Change an action's status
router.patch('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid action id' });
    }
    const { status } = req.body;
    if (!ACTION_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${ACTION_STATUSES.join(', ')}` });
    }

    const action = actionItemsRepo.updateByIdAndUser(id, req.userId, { status });
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }
    res.json(action);
  } catch (error) {
    console.error('Update action error:', error);
    res.status(500).json({ error: 'Error updating the action' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid action id' });
    }
    if (!actionItemsRepo.deleteByIdAndUser(id, req.userId)) {
      return res.status(404).json({ error: 'Action not found' });
    }
    res.json({ message: 'Action removed' });
  } catch (error) {
    console.error('Delete action error:', error);
    res.status(500).json({ error: 'Error removing the action' });
  }
});

export default router;
