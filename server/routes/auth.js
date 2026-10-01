import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { usersRepo, deleteUserAccount } from '../db/repos.js';
import auth from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/passwordResetEmail.js';
import { appBaseUrl } from '../config/env.js';

const router = express.Router();

// Stricter limit on endpoints that check credentials, to slow down brute forcing.
// Only failed attempts count, so people sharing an IP (office, school) are not
// locked out by normal use.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many attempts. Please try again in a few minutes.' }
});

// Password reset requests return 200 for both known and unknown emails, so
// they need a limiter that counts successful responses as well.
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many reset requests. Please try again later.' },
});

// Generate JWT token. Embeds the user's current tokenVersion so a password
// change / reset / discard bumps the version and invalidates old sessions.
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Hash a plaintext password (explicit replacement for the old Mongoose
// pre('save') hook — the DB layer never sees plaintext passwords).
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Unified password policy: at least 6 chars, at most 72 bytes (bcrypt's
// hard input limit — longer inputs are silently truncated by bcrypt, which
// would let two different long passwords collide).
const MAX_PASSWORD_BYTES = 72;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const parseName = (value) => {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= 100 ? name : null;
};
const getPasswordError = (password) => {
  if (typeof password !== 'string') return 'Password must be a string';
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes`;
  }
  return null;
};

const normalizeEmail = (email) => email.trim().toLowerCase();

// Password-reset tokens are stored as SHA-256 hashes so a DB leak does not
// expose usable reset links.
const hashResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Sign up
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    // Validate input
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const parsedName = parseName(name);
    if (!parsedName) {
      return res.status(400).json({ error: 'Please enter your name (up to 100 characters)' });
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Check if user already exists
    const existingUser = usersRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash the password before storing it
    const hashed = await hashPassword(password);

    const user = usersRepo.create({
      email: normalizedEmail,
      name: parsedName,
      password: hashed,
    });

    const safeUser = usersRepo.toSafeUser(user);

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      user: safeUser,
      token,
      session: { access_token: token, user: safeUser }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Sign in
router.post('/signin', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate input
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find user
    const user = usersRepo.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Password-less (Google) accounts cannot use password sign-in
    if (!user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    usersRepo.updateLastLogin(user.id);

    const safeUser = usersRepo.toSafeUser(usersRepo.findById(user.id));

    // Generate token
    const token = generateToken(user);

    res.json({
      user: safeUser,
      token,
      session: { access_token: token, user: safeUser }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Error signing in' });
  }
});

// Get current user (verify session)
router.get('/session', auth, async (req, res) => {
  try {
    res.json({
      session: {
        access_token: req.header('Authorization')?.replace('Bearer ', ''),
        user: req.user
      }
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Error getting session' });
  }
});

// Update user
router.put('/user', authLimiter, auth, async (req, res) => {
  try {
    const { name, password, currentPassword } = req.body || {};
    const user = usersRepo.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Password changes require re-authentication with the current password.
    // Accounts without a password (Google-only) may set their first password.
    if (password !== undefined) {
      const passwordError = getPasswordError(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }
      if (user.password) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to change your password' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
      }
    }

    const fields = {};
    if (name !== undefined) {
      const parsedName = parseName(name);
      if (!parsedName) return res.status(400).json({ error: 'Please enter your name (up to 100 characters)' });
      fields.name = parsedName;
    }
    if (password !== undefined) {
      fields.password = await hashPassword(password);
      // Invalidate every previously issued session token.
      fields.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    const updated = usersRepo.update(user.id, fields);
    const safeUser = usersRepo.toSafeUser(updated);

    // A password change bumped tokenVersion, so the old token is now dead.
    // Return a fresh token so the client can continue without re-signing-in.
    if (fields.password) {
      const token = generateToken(updated);
      return res.json({
        user: safeUser,
        token,
        session: { access_token: token, user: safeUser },
      });
    }

    res.json({ user: safeUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Error updating user' });
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

// Google sign-in with a Google Identity Services ID token. The legacy popup
// code path remains accepted for clients still using it.
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, googleToken: authCode, redirectUri, idToken, password, discardPassword } = req.body || {};

    if (!authCode && !idToken && !credential) {
      return res.status(400).json({ error: 'Authorization code or ID token required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || (authCode && !clientSecret)) {
      return res.status(500).json({
        error: 'Google OAuth is not configured on the server.'
      });
    }

    const oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri || 'postmessage');

    // Two entry points: a fresh authorization code (popup callback flow) or a
    // previously-verified Google ID token (retry after the account turned out
    // to already have a password). Authorization codes are single-use, so the
    // retry always carries the ID token, which is reusable and still signed.
    let verifiedIdToken = credential || idToken;
    if (!verifiedIdToken) {
      // Exchange the authorization code for tokens
      const { tokens } = await oauthClient.getToken({ code: authCode, redirect_uri: redirectUri });
      verifiedIdToken = tokens.id_token;
    }

    if (!verifiedIdToken) {
      return res.status(401).json({ error: 'Google authentication failed' });
    }

    // Verify the ID token's signature and audience — this is the security
    // boundary: only Google-issued tokens for our client are accepted.
    const ticket = await oauthClient.verifyIdToken({ idToken: verifiedIdToken, audience: clientId });
    const payload = ticket.getPayload();

    const {
      sub: googleId,
      email,
      email_verified: emailVerified,
      given_name: givenName,
      family_name: familyName,
      name,
    } = payload || {};

    // A Google login is only trusted when Google vouches for the email.
    if (!googleId || !email || !emailVerified) {
      return res.status(401).json({ error: 'Google authentication failed' });
    }

    const normalizedEmail = normalizeEmail(email);

    // Find by Google ID first; then link an existing account whose verified
    // email matches (proves ownership of that email).
    let user = usersRepo.findByGoogleId(googleId);
    if (!user && normalizedEmail) {
      const existing = usersRepo.findByEmail(normalizedEmail);
      if (existing) {
        // A different Google account has already claimed this email.
        if (existing.googleId && existing.googleId !== googleId) {
          return res.status(409).json({
            error: 'This email is already linked to a different Google account.',
            code: 'GOOGLE_EMAIL_LINKED',
          });
        }

        // This account has a password and its email was never verified, so
        // blindly linking the Google identity would take over the account.
        // The client must prove the password — or explicitly discard it
        // (replacing password login with Google-only). The ID token is
        // returned on the 409 so the frontend can retry without burning
        // another single-use authorization code.
        if (!existing.isEmailVerified && existing.password) {
          if (typeof password === 'string') {
            const isMatch = await bcrypt.compare(password, existing.password);
            if (!isMatch) {
              return res.status(409).json({
                error: 'Incorrect password for this account.',
                code: 'LINK_PASSWORD_REQUIRED',
                idToken: verifiedIdToken,
              });
            }
          } else if (discardPassword === true) {
            user = usersRepo.update(existing.id, {
              googleId,
              isEmailVerified: true,
              password: null,
              // Removing the password invalidates every existing session.
              tokenVersion: (existing.tokenVersion || 0) + 1,
            });
          } else {
            return res.status(409).json({
              error: 'This email already has a password. Enter it to link your Google account.',
              code: 'LINK_PASSWORD_REQUIRED',
              idToken: verifiedIdToken,
            });
          }
        }

        if (!user) {
          user = usersRepo.update(existing.id, {
            googleId,
            isEmailVerified: true,
          });
        }
      }
    }

    // Otherwise create a new account (no password — email is Google-verified)
    if (!user) {
      user = usersRepo.create({
        email: normalizedEmail || `google-${googleId}@localhost`,
        name: parseName(name) || parseName([givenName, familyName].filter(Boolean).join(' ')),
        firstName: givenName || name || 'Google',
        lastName: familyName || '',
        googleId,
        isEmailVerified: true,
      });
    }

    if (!user.name) {
      user = usersRepo.update(user.id, {
        name: parseName(name) || parseName([givenName, familyName].filter(Boolean).join(' ')) || 'Google',
      });
    }

    // Update last login
    usersRepo.updateLastLogin(user.id);

    const safeUser = usersRepo.toSafeUser(usersRepo.findById(user.id));
    const token = generateToken(user);

    res.json({
      token,
      user: safeUser,
      session: { access_token: token, user: safeUser }
    });
  } catch (error) {
    console.error('Google OAuth error details:', error.message);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// Request a password reset. The token is delivered only to the account's
// verified inbox, never in the API response or server logs.
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESET_FROM_EMAIL) {
      return res.status(503).json({ error: 'Password reset email is not configured.' });
    }

    const { email } = req.body || {};

    if (typeof email === 'string' && email.trim()) {
      const user = usersRepo.findByEmail(normalizeEmail(email));
      // Only accounts with a password can be reset (Google accounts sign in
      // via Google instead).
      if (user && user.password) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        const resetUrl = new URL('/reset-password', appBaseUrl());
        // A fragment is not sent in HTTP requests or Referer headers.
        resetUrl.hash = new URLSearchParams({ token }).toString();

        // Saved before sending, so the emailed link always works
        usersRepo.update(user.id, {
          resetPasswordToken: hashResetToken(token),
          resetPasswordExpires: expires,
        });
        await sendPasswordResetEmail(user.email, resetUrl.toString());
      }
    }

    res.json({ message: 'Password reset instructions sent (if the account exists).' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(503).json({ error: 'Password reset email is temporarily unavailable.' });
  }
});

// Complete a password reset with the emailed token
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (typeof token !== 'string' || !token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = usersRepo.findByResetTokenHash(hashResetToken(token));
    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired' });
    }

    const hashed = await hashPassword(password);
    usersRepo.update(user.id, {
      password: hashed,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      // A reset changes who is allowed to sign in — invalidate old sessions.
      tokenVersion: (user.tokenVersion || 0) + 1,
    });

    res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Delete account — requires the password again so a stolen session token
// cannot be used alone to destroy the account. All user data is removed in a
// single transaction.
router.delete('/account', authLimiter, auth, async (req, res) => {
  try {
    const { password } = req.body || {};
    const user = usersRepo.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.password) {
      if (!password) {
        return res.status(400).json({ error: 'Password is required to delete your account' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Password is incorrect' });
      }
    }

    deleteUserAccount(user.id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

export default router;
