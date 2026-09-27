// Env must load before anything else evaluates: app.js and the SQLite layer
// read process.env when their modules are evaluated.
import { getMissingRequiredEnv } from './config/env.js';
import './db/index.js'; // SQLite bootstrap: opens the local DB and applies pending Drizzle migrations

import app from './app.js';

const missingEnv = getMissingRequiredEnv();
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('GOOGLE_CLIENT_ID is not set; Google sign-in is disabled');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});