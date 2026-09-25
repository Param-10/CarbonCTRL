import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CarbonActivity from '../models/CarbonActivity.js';
import CarbonAssessment from '../models/CarbonAssessment.js';
import Emission from '../models/Emission.js';
import auth from '../middleware/auth.js';
import { isGoogleAuthConfigured, verifyGoogleIdToken } from '../services/googleAuth.js';

const router = express.Router();

const MIN_PASSWORD_LENGTH = 6;
const TWO_FACTOR_TOKEN_PURPOSE = '2fa';

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

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Short-lived token that only allows completing the 2FA step of a login
const generateTwoFactorToken = (userId) => {
  return jwt.sign(
    { userId, purpose: TWO_FACTOR_TOKEN_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
};

const verifyTotp = (secret, code) => {
  if (!secret || !isNonEmptyString(code)) return false;
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code.trim(),
    window: 1
  });
};

const sendSession = (res, user, status = 200) => {
  const token = generateToken(user._id);
  const userJson = user.toJSON();
  res.status(status).json({
    user: userJson,
    token,
    session: { access_token: token, user: userJson }
  });
};

// Finish a verified login: issue a session, or ask for the 2FA code first
const completeLogin = async (res, user) => {
  if (user.twoFactorEnabled) {
    return res.json({
      twoFactorRequired: true,
      twoFactorToken: generateTwoFactorToken(user._id)
    });
  }

  user.lastLogin = new Date();
  await user.save();
  sendSession(res, user);
};

// Sign up
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      email: normalizedEmail,
      password,
      firstName: typeof firstName === 'string' ? firstName : undefined,
      lastName: typeof lastName === 'string' ? lastName : undefined
    });

    await user.save();

    sendSession(res, user, 201);
  } catch (error) {
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

        // Google has verified ownership of the email, so link it to the existing account
        user.googleId = payload.sub;
        user.isEmailVerified = true;
        if (!user.firstName && payload.given_name) user.firstName = payload.given_name;
        if (!user.lastName && payload.family_name) user.lastName = payload.family_name;
        await user.save();
      } else {
        user = await User.create({
          email,
          googleId: payload.sub,
          firstName: payload.given_name,
          lastName: payload.family_name,
          isEmailVerified: true
        });
      }
    }

    await completeLogin(res, user);
  } catch (error) {
    console.error('Google sign-in error:', error);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

// Complete a login for an account with 2FA enabled
router.post('/2fa/login', authLimiter, async (req, res) => {
  try {
    const { twoFactorToken, code } = req.body;

    if (!isNonEmptyString(twoFactorToken) || !isNonEmptyString(code)) {
      return res.status(400).json({ error: '2FA token and code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(twoFactorToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Your sign-in attempt expired. Please sign in again.' });
    }

    if (decoded.purpose !== TWO_FACTOR_TOKEN_PURPOSE) {
      return res.status(401).json({ error: 'Invalid 2FA session' });
    }

    const user = await User.findById(decoded.userId).select('+twoFactorSecret');
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ error: 'Invalid 2FA session' });
    }

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    user.lastLogin = new Date();
    await user.save();

    sendSession(res, user);
  } catch (error) {
    console.error('2FA login error:', error);
    res.status(500).json({ error: 'Error verifying 2FA code' });
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
    const { firstName, lastName, password, currentPassword } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (
      (firstName !== undefined && typeof firstName !== 'string') ||
      (lastName !== undefined && typeof lastName !== 'string')
    ) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (password) {
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Accounts created with Google have no password yet and may set one directly
      if (user.password) {
        const isMatch = isNonEmptyString(currentPassword) && await user.comparePassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      }

      user.password = password;
    }

    await user.save();

    res.json({
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

// Delete account and all associated data
router.delete('/user', authLimiter, auth, async (req, res) => {
  try {
    const { password, code } = req.body || {};
    const user = await User.findById(req.userId).select('+twoFactorSecret');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Re-confirm identity: password if the account has one, otherwise a 2FA code if enabled
    if (user.password) {
      const isMatch = isNonEmptyString(password) && await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Password is incorrect' });
      }
    } else if (user.twoFactorEnabled && !verifyTotp(user.twoFactorSecret, code)) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
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

// Start 2FA setup: generate a secret and keep it pending until verified
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    const secret = speakeasy.generateSecret({
      name: `CarbonCTRL (${user.email})`,
      issuer: 'CarbonCTRL'
    });

    user.twoFactorTempSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Error setting up 2FA' });
  }
});

// Verify the pending secret and enable 2FA
router.post('/2fa/verify', auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.userId).select('+twoFactorTempSecret');

    if (!user.twoFactorTempSecret) {
      return res.status(400).json({ error: 'Start 2FA setup first' });
    }

    if (!verifyTotp(user.twoFactorTempSecret, code)) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }

    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = undefined;
    user.twoFactorEnabled = true;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Error verifying 2FA code' });
  }
});

// Disable 2FA (requires a current code)
router.post('/2fa/disable', authLimiter, auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.userId).select('+twoFactorSecret');

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(400).json({ error: 'Invalid 2FA code' });
    }

    user.twoFactorSecret = undefined;
    user.twoFactorEnabled = false;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Error disabling 2FA' });
  }
});

export default router;
