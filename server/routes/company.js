import express from 'express';
import { profilesRepo } from '../db/repos.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get company profile
router.get('/profile', auth, async (req, res) => {
  try {
    const profile = profilesRepo.findByUserId(req.userId);

    if (!profile) {
      return res.status(404).json({ error: 'No company profile found' });
    }

    res.json(profile);
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

    const profile = profilesRepo.upsert(req.userId, {
      name,
      industry,
      employees,
      location,
      phone,
      email,
      founded,
      description
    });

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

    const updated = profilesRepo.updateByUserId(req.userId, {
      name: req.body.name,
      industry: req.body.industry,
      employees: req.body.employees,
      location: req.body.location,
      phone: req.body.phone,
      email: req.body.email,
      founded: req.body.founded,
      description: req.body.description
    });

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