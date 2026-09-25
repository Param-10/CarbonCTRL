import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load server/.env regardless of the directory the server is started from.
// Variables already set in the environment (e.g. by the host) take precedence.
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];

export function getMissingRequiredEnv() {
  return REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
}
