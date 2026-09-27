import express from 'express';
import { assessmentsRepo, activitiesRepo, emissionsRepo, resetUserData } from '../db/repos.js';
import auth from '../middleware/auth.js';

const router = express.Router();

/** Get the user's current (latest active) assessment, creating one if needed. */
const getOrCreateActiveAssessment = (userId) => {
  let assessment = assessmentsRepo.findActiveByUserId(userId);
  if (!assessment) {
    assessment = assessmentsRepo.create(userId);
  }
  return assessment;
};

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
    const { sector, subsector, activityAmount, activityUnit } = req.body;

    // Validate required fields
    if (!sector || !subsector || activityAmount === undefined || !activityUnit) {
      return res.status(400).json({
        error: 'Sector, subsector, activity amount, and activity unit are required'
      });
    }

    if (typeof activityAmount !== 'number' || activityAmount < 0) {
      return res.status(400).json({ error: 'Activity amount must be a non-negative number' });
    }

    // Get or create assessment
    const assessment = getOrCreateActiveAssessment(req.userId);

    // Create activity
    const activity = activitiesRepo.create({
      assessmentId: assessment.id,
      userId: req.userId,
      sector,
      subsector,
      activityAmount,
      activityUnit
    });

    res.status(201).json(activity);
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'Error adding carbon activity' });
  }
});

// Delete carbon activity
router.delete('/activity/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid activity id' });
    }

    const deleted = activitiesRepo.deleteByIdAndUser(id, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Activity not found' });
    }

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

// Update assessment with calculated score
router.put('/assessment/:id', auth, async (req, res) => {
  try {
    const { totalEmissions, grade, emissionsBreakdown } = req.body;

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid assessment id' });
    }

    const assessment = assessmentsRepo.findById(id);

    // Scope-check: the assessment must belong to the requesting user
    if (!assessment || assessment.userId !== req.userId) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Update assessment and rebuild emissions atomically
    const updated = assessmentsRepo.updateById(id, {
      totalEmissions,
      grade
    });

    // Delete existing emissions data and insert the new breakdown + total in
    // a single transaction (no partial state if anything fails).
    const emissionEntries = [];
    if (emissionsBreakdown && typeof emissionsBreakdown === 'object') {
      Object.entries(emissionsBreakdown).forEach(([type, amount]) => {
        if (typeof amount === 'number' && Number.isFinite(amount)) {
          emissionEntries.push({ type, amount });
        }
      });
    }

    emissionEntries.push({ type: 'total', amount: totalEmissions ?? 0 });

    emissionsRepo.replaceAll(req.userId, emissionEntries);

    res.json(updated);
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ error: 'Error updating carbon assessment' });
  }
});

// Reset all carbon data
router.delete('/reset', auth, async (req, res) => {
  try {
    resetUserData(req.userId);
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

    res.json({
      assessment,
      activities,
      emissions
    });
  } catch (error) {
    console.error('Get saved data error:', error);
    res.status(500).json({ error: 'Error fetching saved carbon data' });
  }
});

export default router;