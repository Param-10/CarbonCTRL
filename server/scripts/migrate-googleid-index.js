// Must be the first import: loads server/.env
import { getMissingRequiredEnv } from '../config/env.js';
import mongoose from 'mongoose';

import { ensureUniqueGoogleIdIndex } from '../migrations/uniqueGoogleIdIndex.js';

if (getMissingRequiredEnv().includes('MONGODB_URI')) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

try {
  // Build the index here, not through Mongoose's automatic index creation
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  const { changed } = await ensureUniqueGoogleIdIndex();
  console.log(changed ? 'googleId index is now unique' : 'googleId index was already unique');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
