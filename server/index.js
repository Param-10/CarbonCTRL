// Must be the first import: app.js reads process.env when it is evaluated
import { getMissingRequiredEnv } from './config/env.js';
import mongoose from 'mongoose';

import app from './app.js';
import { ensureUniqueGoogleIdIndex } from './migrations/uniqueGoogleIdIndex.js';

const missingEnv = getMissingRequiredEnv();
if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('GOOGLE_CLIENT_ID is not set; Google sign-in is disabled');
}

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('Connected to MongoDB');
  ensureUniqueGoogleIdIndex()
    .then(({ changed }) => {
      if (changed) console.log('googleId index is now unique');
    })
    // The app still works without it; only duplicate Google accounts are no longer blocked
    .catch(err => console.error('Could not make the googleId index unique:', err.message));
})
.catch(err => {
  // Nothing works without the database; exit so the host can restart the service
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
