import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      user: user.toJSON(),
      token,
      session: { access_token: token, user: user.toJSON() }
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

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      user: user.toJSON(),
      token,
      session: { access_token: token, user: user.toJSON() }
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
        user: req.user.toJSON()
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
    const { firstName, lastName, password } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields if provided
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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

// Google OAuth callback
router.post('/google', async (req, res) => {
  try {
    console.log('=== GOOGLE OAUTH DEBUG START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { googleToken: authCode } = req.body; // Reusing existing field name for authorization code
    
    console.log('Google OAuth request received:', { authCode: authCode ? 'present' : 'missing' });
    
    if (!authCode) {
      console.log('ERROR: No authorization code provided');
      return res.status(400).json({ error: 'Authorization code required' });
    }
    
    // Generate a unique email for the demo user
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const demoEmail = `google-user-${timestamp}-${randomId}@demo.carbonctrl.com`;
    
    console.log('Generated demo email:', demoEmail);
    console.log('Email length:', demoEmail.length);
    console.log('Email type:', typeof demoEmail);
    
    // First check if a user with this googleId already exists
    let user = await User.findOne({ googleId: authCode });
    console.log('Existing user check result:', user ? 'found' : 'not found');
    
    if (!user) {
      console.log('Creating new Google user...');
      
      // Create new user from Google account
      const userData = {
        email: demoEmail,
        firstName: 'Google',
        lastName: 'User',
        googleId: authCode,
        isEmailVerified: true
      };
      
      console.log('User data to create:', JSON.stringify(userData, null, 2));
      
      // Test email validation before creating user
      console.log('Testing email field specifically...');
      console.log('userData.email exists:', !!userData.email);
      console.log('userData.email value:', userData.email);
      
      try {
        user = new User(userData);
        console.log('User object created, validating...');
        
        // Test validation before save
        const validationError = user.validateSync();
        if (validationError) {
          console.log('Validation errors:', JSON.stringify(validationError.errors, null, 2));
          throw validationError;
        }
        
        console.log('Validation passed, saving user...');
        await user.save();
        console.log('User created successfully:', user._id);
        console.log('Saved user email:', user.email);
        
      } catch (userCreationError) {
        console.log('USER CREATION ERROR:', userCreationError.message);
        console.log('ERROR DETAILS:', JSON.stringify(userCreationError, null, 2));
        throw userCreationError;
      }
    } else {
      console.log('Existing Google user found:', user._id);
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user._id);
    
    console.log('Google OAuth success, returning token');
    console.log('=== GOOGLE OAUTH DEBUG END ===');
    
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      }
    });
  } catch (error) {
    console.log('=== GOOGLE OAUTH ERROR ===');
    console.error('Google OAuth error details:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    console.log('=== END ERROR ===');
    res.status(400).json({ error: error.message || 'Google OAuth failed' });
  }
});

// Generate 2FA secret
router.post('/2fa/setup', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
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
    
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });
    
    if (verified) {
      await User.findByIdAndUpdate(req.userId, {
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

// Disable 2FA
router.post('/2fa/disable', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      twoFactorSecret: null,
      twoFactorEnabled: false
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 