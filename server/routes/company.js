import express from 'express';
import CompanyProfile from '../models/CompanyProfile.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get company profile
router.get('/profile', auth, async (req, res) => {
  try {
    const profile = await CompanyProfile.findOne({ userId: req.userId });
    
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

    // Check if profile already exists
    let profile = await CompanyProfile.findOne({ userId: req.userId });

    if (profile) {
      // Update existing profile
      profile.name = name;
      profile.industry = industry;
      profile.employees = employees;
      profile.location = location;
      profile.phone = phone;
      profile.email = email;
      profile.founded = founded;
      profile.description = description;
      
      await profile.save();
    } else {
      // Create new profile
      profile = new CompanyProfile({
        userId: req.userId,
        name,
        industry,
        employees,
        location,
        phone,
        email,
        founded,
        description
      });
      
      await profile.save();
    }

    res.json(profile);
  } catch (error) {
    console.error('Save profile error:', error);
    res.status(500).json({ error: 'Error saving company profile' });
  }
});

// Update company profile
router.put('/profile', auth, async (req, res) => {
  try {
    const profile = await CompanyProfile.findOne({ userId: req.userId });

    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    // Update fields that are provided
    const allowedFields = ['name', 'industry', 'employees', 'location', 'phone', 'email', 'founded', 'description'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field];
      }
    });

    await profile.save();

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Error updating company profile' });
  }
});

// Delete company profile
router.delete('/profile', auth, async (req, res) => {
  try {
    const profile = await CompanyProfile.findOneAndDelete({ userId: req.userId });

    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json({ message: 'Company profile deleted successfully' });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Error deleting company profile' });
  }
});

export default router; 