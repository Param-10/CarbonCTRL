import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Point DATABASE_PATH at a throwaway SQLite file *before* any server module
 * is imported, so db/index.js (and the app that mounts it) initialize against
 * a clean database for the test run.
 */
export function setTempDb(prefix = 'carbonctrl-test') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const dbPath = path.join(dir, 'test.db');
  process.env.DATABASE_PATH = dbPath;
  return dbPath;
}

/** Drop the temp DB file (plus WAL/shm sidecars) after the run. */
export function cleanUpDb(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      /* ignore */
    }
  }
  try {
    fs.rmdirSync(path.dirname(dbPath));
  } catch {
    /* ignore */
  }
}