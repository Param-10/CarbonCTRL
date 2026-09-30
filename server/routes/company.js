import express from 'express';
import { profilesRepo } from '../db/repos.js';
import { parseProfileContext } from '../config/profileOptions.js';
import { EMPLOYEE_RANGE_ESTIMATES } from '../config/industryBenchmarks.js';
import { recommendationRefresh } from '../services/recommendationRefresh.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// The range sets the headcount for grading when no exact count is given
const EMPLOYEE_RANGE_ERROR = `employees must be one of: ${Object.keys(EMPLOYEE_RANGE_ESTIMATES).join(', ')}`;
const isEmployeeRange = (value) => typeof value === 'string' && Object.hasOwn(EMPLOYEE_RANGE_ESTIMATES, value);

// Get company profile
router.get('/profile', auth, async (req, res) => {
  try {
    // New users have no profile yet; that is a normal state, not an error
    const profile = profilesRepo.findByUserId(req.userId);

    // `?? null` matters: res.json(undefined) sends an empty body, which the
    // client can't parse as JSON
    res.json(profile ?? null);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Error fetching company profile' });
  }
});

// Create or update company profile
router.post('/profile', auth, async (req, res) => {
  try {
    const { name, industry, employees, location, phone, email, founded, description } = req.body;

    // Validate required fields
    if (!name || !industry || !employees || !location) {
      return res.status(400).json({
        error: 'Name, industry, employees, and location are required'
      });
    }
    if (!isEmployeeRange(employees)) {
      return res.status(400).json({ error: EMPLOYEE_RANGE_ERROR });
    }

    const context = parseProfileContext(req.body);
    if (context.errors.length > 0) {
      return res.status(400).json({ error: context.errors.join('; ') });
    }

    const profile = profilesRepo.upsert(req.userId, {
      name,
      industry,
      employees,
      location,
      phone,
      email,
      founded,
      description,
      ...context.values
    });
    recommendationRefresh.schedule(req.userId);

    res.json(profile);
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ error: 'Error saving company profile' });
  }
});

// Update company profile
router.put('/profile', auth, async (req, res) => {
  try {
    const profile = profilesRepo.findByUserId(req.userId);

    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }
    if (req.body.employees !== undefined && !isEmployeeRange(req.body.employees)) {
      return res.status(400).json({ error: EMPLOYEE_RANGE_ERROR });
    }

    const context = parseProfileContext(req.body);
    if (context.errors.length > 0) {
      return res.status(400).json({ error: context.errors.join('; ') });
    }

    const updated = profilesRepo.updateByUserId(req.userId, {
      name: req.body.name,
      industry: req.body.industry,
      employees: req.body.employees,
      location: req.body.location,
      phone: req.body.phone,
      email: req.body.email,
      founded: req.body.founded,
      description: req.body.description,
      ...context.values
    });
    recommendationRefresh.schedule(req.userId);

    res.json(updated);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Error updating company profile' });
  }
});

// Delete company profile
router.delete('/profile', auth, async (req, res) => {
  try {
    const deleted = profilesRepo.deleteByUserId(req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json({ message: 'Company profile deleted successfully' });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Error deleting company profile' });
  }
});

export default router;