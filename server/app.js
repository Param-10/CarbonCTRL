import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import carbonRoutes from './routes/carbon.js';
import companyRoutes from './routes/company.js';
import geminiRoutes from './routes/gemini.js';
import actionRoutes from './routes/actions.js';
import reminderRoutes from './routes/reminders.js';
import methodologyRoutes from './routes/methodology.js';
import { pingDatabase } from './db/index.js';

const app = express();

// Behind a hosting proxy (e.g. Render), set TRUST_PROXY to the number of proxy hops
// so rate limits key on the real client IP instead of the proxy's
const trustProxyHops = Number(process.env.TRUST_PROXY);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

// Security middleware
app.use(helmet());

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://carbonctrl.us',
  'https://carbonctrl.netlify.app'
];

const envOrigins = (process.env.FRONTEND_URL || process.env.FRONTEND_URLS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));

// Simple and reliable CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// General rate limit against abuse. One page load makes several requests, so
// this must leave room for normal use; sign-in and password reset have their
// own stricter limits (routes/auth.js). JSON message so the app can show it.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests right now. Please wait a minute and try again.' }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/carbon', carbonRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/methodology', methodologyRoutes);

// Health check endpoint (SQLite is local, so this reflects DB availability)
app.get('/health', (req, res) => {
  try {
    const dbOk = pingDatabase();
    if (!dbOk) {
      return res.status(503).json({ status: 'ERROR', database: 'unavailable', timestamp: new Date().toISOString() });
    }
    res.json({ status: 'OK', database: 'connected', storage: 'sqlite', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'ERROR', database: 'unavailable', error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
