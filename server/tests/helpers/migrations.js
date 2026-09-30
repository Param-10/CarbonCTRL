import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

/**
 * Copy the migrations folder into `workDir`, truncated after `tag`, so a
 * database can be migrated to that version, seeded with old-format rows, and
 * then brought up to date with the real folder.
 */
export function migrationsUpTo(workDir, tag) {
  const dir = path.join(workDir, `migrations-up-to-${tag}`);
  fs.cpSync(MIGRATIONS_DIR, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const lastIndex = journal.entries.findIndex((entry) => entry.tag === tag);
  if (lastIndex === -1) throw new Error(`Unknown migration tag ${tag}`);
  journal.entries = journal.entries.slice(0, lastIndex + 1);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}
