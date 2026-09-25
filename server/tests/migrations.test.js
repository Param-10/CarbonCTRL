import { describe, it, expect, beforeEach } from 'vitest';

import { useTestDatabase } from './helpers/db.js';
import User from '../models/User.js';
import { ensureUniqueGoogleIdIndex } from '../migrations/uniqueGoogleIdIndex.js';

useTestDatabase();

// Recreate the index an older version of the schema built
const useLegacyGoogleIdIndex = async () => {
  await User.collection.dropIndex('googleId_1');
  await User.collection.createIndex({ googleId: 1 }, { name: 'googleId_1', sparse: true });
};

const findGoogleIdIndex = async () =>
  (await User.collection.indexes()).find((index) => index.name === 'googleId_1');

describe('unique googleId index migration', () => {
  beforeEach(async () => {
    await useLegacyGoogleIdIndex();
  });

  it('shows why the migration is needed: Mongoose cannot upgrade the old index itself', async () => {
    await expect(User.createIndexes()).rejects.toThrow();
    expect((await findGoogleIdIndex()).unique).toBeFalsy();
  });

  it('replaces the old index with a unique one and leaves users without Google alone', async () => {
    await User.collection.insertMany([
      { email: 'a@example.com', password: 'hash' },
      { email: 'b@example.com', password: 'hash' },
      { email: 'c@example.com', googleId: 'google-1' }
    ]);

    const result = await ensureUniqueGoogleIdIndex();

    expect(result.changed).toBe(true);
    expect(await findGoogleIdIndex()).toMatchObject({ unique: true, sparse: true });
    await expect(
      User.collection.insertOne({ email: 'd@example.com', googleId: 'google-1' })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('does nothing when the index is already unique', async () => {
    await ensureUniqueGoogleIdIndex();

    expect((await ensureUniqueGoogleIdIndex()).changed).toBe(false);
  });

  it('stops and names the users when a Google ID is already shared, keeping the old index', async () => {
    await User.collection.insertMany([
      { email: 'a@example.com', googleId: 'google-1' },
      { email: 'b@example.com', googleId: 'google-1' }
    ]);

    await expect(ensureUniqueGoogleIdIndex()).rejects.toThrow(/google-1/);
    expect(await findGoogleIdIndex()).toBeTruthy();
  });
});
