import express from 'express';
import auth from '../middleware/auth.js';
import { usersRepo } from '../db/repos.js';
import { isEmailConfigured } from '../services/monthlyReminders.js';

const router = express.Router();

const settingsFor = (user) => ({
  monthlyReminders: Boolean(user.monthlyReminders),
  // Whether this server can actually send email; the UI explains if not
  emailConfigured: isEmailConfigured(),
});

router.get('/settings', auth, async (req, res) => {
  res.json(settingsFor(req.user));
});

router.put('/settings', auth, async (req, res) => {
  try {
    const { monthlyReminders } = req.body;
    if (typeof monthlyReminders !== 'boolean') {
      return res.status(400).json({ error: 'monthlyReminders must be true or false' });
    }
    const user = usersRepo.update(req.userId, { monthlyReminders });
    res.json(settingsFor(user));
  } catch (error) {
    console.error('Update reminder settings error:', error);
    res.status(500).json({ error: 'Error updating reminder settings' });
  }
});

export default router;
