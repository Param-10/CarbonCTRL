import User from '../models/User.js';

const INDEX_NAME = 'googleId_1';

// Older databases have a non-unique googleId_1 index. Mongoose's auto-indexing cannot change the
// options of an existing index, so it fails (and only logs) when the schema asks for unique: true.
// Replaces the old index with the unique one. Safe to run more than once.
export async function ensureUniqueGoogleIdIndex() {
  const collection = User.collection;
  const indexes = await collection.indexes().catch((error) => {
    // A brand-new database has no users collection yet
    if (error.codeName === 'NamespaceNotFound') return [];
    throw error;
  });

  const existing = indexes.find((index) => index.name === INDEX_NAME);
  if (existing?.unique) {
    return { changed: false };
  }

  const duplicates = await collection.aggregate([
    { $match: { googleId: { $type: 'string' } } },
    { $group: { _id: '$googleId', count: { $sum: 1 }, userIds: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicates.length > 0) {
    const details = duplicates
      .map(({ _id, userIds }) => `${_id}: ${userIds.join(', ')}`)
      .join('\n');
    throw new Error(`Cannot make googleId unique; these Google IDs are shared by several users:\n${details}`);
  }

  if (existing) {
    await collection.dropIndex(INDEX_NAME);
  }
  await collection.createIndex({ googleId: 1 }, { name: INDEX_NAME, unique: true, sparse: true });

  return { changed: true };
}
