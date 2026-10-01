import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load server/.env regardless of the directory the server is started from.
// Variables already set in the environment (e.g. by the host) take precedence.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const REQUIRED_ENV_VARS = ['JWT_SECRET'];

/**
 * The app's own address for links in emails. FRONTEND_URL may list several
 * origins for CORS (see app.js); the first one is the app's address.
 */
export function appBaseUrl() {
  const origins = process.env.FRONTEND_URL || process.env.FRONTEND_URLS || 'http://localhost:5173';
  return origins.split(',')[0].trim().replace(/\/$/, '');
}

export function getMissingRequiredEnv() {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
}
