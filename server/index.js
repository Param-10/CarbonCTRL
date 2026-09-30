import './config/nodeVersion.js'; // must stay first: exits on unsupported Node before SQLite loads
// Env must load before anything else evaluates: app.js and the SQLite layer
// read process.env when their modules are evaluated.
import { getMissingRequiredEnv } from './config/env.js';
import './db/index.js'; // SQLite bootstrap: opens the local DB and applies pending Drizzle migrations

import app from './app.js';
import { startMonthlyReminders } from './services/monthlyReminders.js';

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

// Started here rather than in app.js so tests that import the app don't run it
startMonthlyReminders();