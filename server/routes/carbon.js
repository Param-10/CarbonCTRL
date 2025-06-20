import express from 'express';
import CarbonAssessment from '../models/CarbonAssessment.js';
import CarbonActivity from '../models/CarbonActivity.js';
import Emission from '../models/Emission.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get or create carbon assessment
router.get('/assessment', auth, async (req, res) => {
  try {
    let assessment = await CarbonAssessment.findOne({ 
      userId: req.userId,
      isActive: true 
    }).sort({ createdAt: -1 });

    if (!assessment) {
      // Create new assessment if none exists
      assessment = new CarbonAssessment({
        userId: req.userId,
        totalEmissions: 0,
        grade: 'N/A'
      });
      await assessment.save();
    }

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
    const assessment = await CarbonAssessment.findOne({ 
      userId: req.userId,
      isActive: true 
    }).sort({ createdAt: -1 });

    if (!assessment) {
      return res.json([]);
    }

    const activities = await CarbonActivity.find({ 
      assessmentId: assessment._id 
    }).sort({ createdAt: -1 });

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

    // Get or create assessment
    let assessment = await CarbonAssessment.findOne({ 
      userId: req.userId,
      isActive: true 
    }).sort({ createdAt: -1 });

    if (!assessment) {
      assessment = new CarbonAssessment({
        userId: req.userId,
        totalEmissions: 0,
        grade: 'N/A'
      });
      await assessment.save();
    }

    // Create activity
    const activity = new CarbonActivity({
      assessmentId: assessment._id,
      userId: req.userId,
      sector,
      subsector,
      activityAmount,
      activityUnit
    });

    await activity.save();

    res.status(201).json(activity);
  } catch (error) {
    console.error('Add activity error:', error);
    res.status(500).json({ error: 'Error adding carbon activity' });
  }
});

// Delete carbon activity
router.delete('/activity/:id', auth, async (req, res) => {
  try {
    const activity = await CarbonActivity.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!activity) {
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
    const emissions = await Emission.find({ 
      userId: req.userId,
      type: { $ne: 'total' }
    }).sort({ createdAt: -1 });

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

    const assessment = await CarbonAssessment.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Update assessment
    assessment.totalEmissions = totalEmissions;
    assessment.grade = grade;
    await assessment.save();

    // Delete existing emissions data
    await Emission.deleteMany({ userId: req.userId });

    // Insert new emissions data
    if (emissionsBreakdown) {
      const emissionEntries = Object.entries(emissionsBreakdown).map(([type, amount]) => ({
        userId: req.userId,
        type,
        amount
      }));

      // Add total emissions
      emissionEntries.push({
        userId: req.userId,
        type: 'total',
        amount: totalEmissions
      });

      await Emission.insertMany(emissionEntries);
    }

    res.json(assessment);
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ error: 'Error updating carbon assessment' });
  }
});

// Reset all carbon data
router.delete('/reset', auth, async (req, res) => {
  try {
    // Delete all user's carbon data
    await Promise.all([
      CarbonActivity.deleteMany({ userId: req.userId }),
      CarbonAssessment.deleteMany({ userId: req.userId }),
      Emission.deleteMany({ userId: req.userId })
    ]);

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
    const assessment = await CarbonAssessment.findOne({ 
      userId: req.userId 
    }).sort({ createdAt: -1 });

    if (!assessment) {
      return res.json({
        assessment: null,
        activities: [],
        emissions: []
      });
    }

    // Get activities for this assessment
    const activities = await CarbonActivity.find({ 
      assessmentId: assessment._id 
    });

    // Get emissions data
    const emissions = await Emission.find({ 
      userId: req.userId,
      type: { $ne: 'total' }
    });

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