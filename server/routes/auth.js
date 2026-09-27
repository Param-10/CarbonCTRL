import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { usersRepo, deleteUserAccount } from '../db/repos.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Generate JWT token. Embeds the user's current tokenVersion so a password
// change / reset / discard bumps the version and invalidates old sessions.
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Short-lived token that only authorizes completing a 2FA challenge
const generateTwoFactorToken = (userId) => {
  return jwt.sign({ userId, purpose: 'twoFactor' }, process.env.JWT_SECRET, {
    expiresIn: '5m',
  });
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

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

// Password-reset tokens are stored as SHA-256 hashes so a DB leak does not
// expose usable reset links.
const hashResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = usersRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Hash the password before storing it
    const hashed = await hashPassword(password);

    const user = usersRepo.create({
      email: normalizedEmail,
      password: hashed,
      firstName,
      lastName,
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
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
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

    // If 2FA is enabled, do NOT issue a session yet — the client must first
    // complete a TOTP challenge with the short-lived 2FA token.
    if (user.twoFactorEnabled) {
      return res.json({
        requiresTwoFactor: true,
        twoFactorToken: generateTwoFactorToken(user.id),
        message: 'Two-factor authentication code required',
      });
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

// Complete sign-in with a 2FA code (second factor)
router.post('/signin/2fa', async (req, res) => {
  try {
    const { twoFactorToken, code } = req.body;

    if (!twoFactorToken || !code) {
      return res.status(400).json({ error: 'Two-factor token and code are required' });
    }

    let payload;
    try {
      payload = jwt.verify(twoFactorToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Two-factor session expired. Please sign in again.' });
    }

    if (payload.purpose !== 'twoFactor' || !payload.userId) {
      return res.status(401).json({ error: 'Invalid two-factor token' });
    }

    const user = usersRepo.findById(payload.userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(401).json({ error: 'Two-factor authentication is not active for this account' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid two-factor code' });
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
    console.error('2FA signin error:', error);
    res.status(500).json({ error: 'Error verifying two-factor code' });
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
router.put('/user', auth, async (req, res) => {
  try {
    const { firstName, lastName, password, currentPassword } = req.body;
    const user = usersRepo.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Password changes require re-authentication with the current password.
    // Accounts without a password (Google-only) may set their first password.
    if (password) {
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
    if (firstName !== undefined) fields.firstName = firstName;
    if (lastName !== undefined) fields.lastName = lastName;
    if (password) {
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

// Google OAuth callback.
//
// The frontend obtains an authorization code via the OAuth2 popup flow
// (public/oauth-callback.html) and sends it here. The server exchanges the
// code for tokens, cryptographically verifies the Google ID token, and
// find-or-creates the user from the verified claims (sub = googleId).
router.post('/google', async (req, res) => {
  try {
    const { googleToken: authCode, redirectUri, idToken, password, discardPassword } = req.body;

    if (!authCode && !idToken) {
      return res.status(400).json({ error: 'Authorization code or ID token required' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
      });
    }

    const oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri || 'postmessage');

    // Two entry points: a fresh authorization code (popup callback flow) or a
    // previously-verified Google ID token (retry after the account turned out
    // to already have a password). Authorization codes are single-use, so the
    // retry always carries the ID token, which is reusable and still signed.
    let verifiedIdToken = idToken;
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
        firstName: givenName || name || 'Google',
        lastName: familyName || '',
        googleId,
        isEmailVerified: true,
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

// Request a password reset. Always returns the same generic message to avoid
// user enumeration. The reset link would be emailed in production; this
// local build has no mailer, so it is returned in `resetUrl` for the demo.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (email) {
      const user = usersRepo.findByEmail(normalizeEmail(email));
      // Only accounts with a password can be reset (Google accounts sign in
      // via Google instead).
      if (user && user.password) {
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        usersRepo.update(user.id, {
          resetPasswordToken: hashResetToken(token),
          resetPasswordExpires: expires,
        });

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;

        console.log(`[password-reset] reset link for ${user.email}: ${resetUrl}`);
        return res.json({
          message: 'Password reset instructions sent (if the account exists).',
          // NOTE: in production this link is emailed and NEVER returned here.
          resetUrl,
        });
      }
    }

    res.json({ message: 'Password reset instructions sent (if the account exists).' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Error requesting password reset' });
  }
});

// Complete a password reset with the emailed token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
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

// Generate 2FA secret
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = usersRepo.findById(req.userId);

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Two-factor authentication is already enabled' });
    }

    const secret = speakeasy.generateSecret({
      name: `CarbonCTRL (${user.email})`,
      issuer: 'CarbonCTRL'
    });

    // Store temporary secret (don't save to DB until verified)
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify and enable 2FA
router.post('/2fa/verify', auth, async (req, res) => {
  try {
    const { token, secret } = req.body;

    if (!token || !secret) {
      return res.status(400).json({ error: 'Verification code and secret are required' });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (verified) {
      usersRepo.update(req.userId, {
        twoFactorSecret: secret,
        twoFactorEnabled: true
      });

      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid 2FA token' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disable 2FA — requires the current TOTP code so a leaked session token
// cannot silently downgrade the account's security.
router.post('/2fa/disable', auth, async (req, res) => {
  try {
    const { token: code } = req.body;
    const user = usersRepo.findById(req.userId);

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled' });
    }

    if (!code) {
      return res.status(400).json({ error: 'Enter your current two-factor code to disable 2FA' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid two-factor code' });
    }

    usersRepo.update(req.userId, {
      twoFactorSecret: null,
      twoFactorEnabled: false
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete account — requires the password again so a stolen session token
// cannot be used alone to destroy the account. All user data is removed in a
// single transaction.
router.delete('/account', auth, async (req, res) => {
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