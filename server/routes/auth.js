import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CarbonActivity from '../models/CarbonActivity.js';
import CarbonAssessment from '../models/CarbonAssessment.js';
import Emission from '../models/Emission.js';
import auth from '../middleware/auth.js';
import { isGoogleAuthConfigured, verifyGoogleIdToken } from '../services/googleAuth.js';

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;
// bcrypt ignores everything after the first 72 bytes, so longer passwords would be silently truncated
const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 100;
const NAME_ERROR = 'Please enter your name (up to 100 characters)';
const DUPLICATE_KEY_ERROR = 11000;

// Stricter limit on endpoints that check credentials, to slow down brute forcing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Please try again in a few minutes.' }
});

// Rejecting non-strings also blocks query-operator injection like { "$ne": null }
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeEmail = (email) => email.trim().toLowerCase();

// Returns the cleaned-up name, or null if it is missing, blank or too long
const parseName = (name) => {
  if (typeof name !== 'string') return null;
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 && cleaned.length <= MAX_NAME_LENGTH ? cleaned : null;
};

const getGoogleName = (payload) =>
  parseName(payload.name) ??
  parseName([payload.given_name, payload.family_name].filter(Boolean).join(' ')) ??
  undefined;

const getPasswordError = (password) => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return 'Password must be at least 6 characters long';
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return 'Password must be at most 72 characters long';
  }
  return null;
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const sendSession = (res, user, status = 200) => {
  const token = generateToken(user);
  const userJson = user.toJSON();
  res.status(status).json({
    user: userJson,
    token,
    session: { access_token: token, user: userJson }
  });
};

// Finish a verified login
const completeLogin = async (res, user) => {
  user.lastLogin = new Date();
  await user.save();
  sendSession(res, user);
};

// Sign up
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const parsedName = parseName(name);
    if (!parsedName) {
      return res.status(400).json({ error: NAME_ERROR });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      name: parsedName,
      email: normalizedEmail,
      password
    });

    await user.save();

    sendSession(res, user, 201);
  } catch (error) {
    // Two simultaneous sign-ups can both pass the existence check above
    if (error.code === DUPLICATE_KEY_ERROR) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Sign in
router.post('/signin', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Google-only accounts have no password and cannot sign in this way
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await completeLogin(res, user);
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Error signing in' });
  }
});

// Sign in with Google (ID token from Google Identity Services)
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential } = req.body;

    if (!isNonEmptyString(credential)) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    if (!isGoogleAuthConfigured()) {
      console.error('Google sign-in attempted but GOOGLE_CLIENT_ID is not set');
      return res.status(500).json({ error: 'Google sign-in is not configured' });
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(credential);
    } catch (verifyError) {
      console.warn('Google token verification failed:', verifyError.message);
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const email = normalizeEmail(payload.email);
    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        if (user.googleId) {
          return res.status(409).json({ error: 'This email is linked to a different Google account' });
        }

        // Email sign-up never proves ownership, so anyone could have registered this address first.
        // Drop a password nobody verified and sign out its sessions before handing the account over.
        if (!user.isEmailVerified) {
          user.password = undefined;
          user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        }

        // Google has verified ownership of the email, so link it to the existing account
        user.googleId = payload.sub;
        user.isEmailVerified = true;
        if (!user.name) user.name = getGoogleName(payload);
        await user.save();
      } else {
        try {
          user = await User.create({
            name: getGoogleName(payload),
            email,
            googleId: payload.sub,
            isEmailVerified: true
          });
        } catch (createError) {
          if (createError.code !== DUPLICATE_KEY_ERROR) throw createError;
          // A simultaneous first sign-in (double-click, two tabs) may have just created this user
          user = await User.findOne({ googleId: payload.sub });
          if (!user) {
            return res.status(409).json({ error: 'An account with this email was just created. Please try again.' });
          }
        }
      }
    }

    await completeLogin(res, user);
  } catch (error) {
    console.error('Google sign-in error:', error);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

// Get current user (verify session)
router.get('/session', auth, async (req, res) => {
  try {
    // Reload with the password hash so toJSON can report hasPassword
    const user = await User.findById(req.userId);

    res.json({
      session: {
        access_token: req.header('Authorization')?.replace('Bearer ', ''),
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Error getting session' });
  }
});

// Update user
router.put('/user', auth, async (req, res) => {
  try {
    const { name, password, currentPassword } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields if provided
    if (name !== undefined) {
      const parsedName = parseName(name);
      if (!parsedName) {
        return res.status(400).json({ error: NAME_ERROR });
      }
      user.name = parsedName;
    }

const isChangingPassword = password !== undefined;
    if (isChangingPassword) {
      if (typeof password !== 'string') {
        return res.status(400).json({ error: 'Invalid password' });
      }

      const passwordError = getPasswordError(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      // Accounts created with Google have no password yet and may set one directly
      if (user.password) {
        const isMatch = isNonEmptyString(currentPassword) && await user.comparePassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      }

      user.password = password;
      // Sign out every other session; the caller gets a fresh token below
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    await user.save();

    res.json({
      user: user.toJSON(),
      ...(isChangingPassword && { token: generateToken(user) })
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete account and all associated data
router.delete('/user', authLimiter, auth, async (req, res) => {
  try {
    const { password } = req.body || {};
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Re-confirm identity for accounts that have a password
    if (user.password) {
      const isMatch = isNonEmptyString(password) && await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Password is incorrect' });
      }
    }

    await Promise.all([
      CompanyProfile.deleteMany({ userId: user._id }),
      CarbonActivity.deleteMany({ userId: user._id }),
      CarbonAssessment.deleteMany({ userId: user._id }),
      Emission.deleteMany({ userId: user._id })
    ]);
    // Delete the user last so a failed cleanup can be retried with the same session
    await User.deleteOne({ _id: user._id });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

// Sign out (client-side token removal, but we'll confirm the route)
router.post('/signout', auth, async (req, res) => {
  try {
    // In a stateless JWT system, we don't need to do anything server-side
    // The client will remove the token
    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ error: 'Error signing out' });
  }
});

export default router;
