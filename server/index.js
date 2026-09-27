import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Initializes the SQLite database + applies migrations on first import.
import './db/index.js';
import { pingDatabase } from './db/index.js';

import authRoutes from './routes/auth.js';
import carbonRoutes from './routes/carbon.js';
import companyRoutes from './routes/company.js';
import geminiRoutes from './routes/gemini.js';
import mlRoutes from './routes/ml.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
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
app.use('/api/ml', mlRoutes);

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
app.use((err, req, res, next) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});