import { defineConfig } from 'drizzle-kit';

// Used by `npm run db:generate`; paths are relative to the project root
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.js',
  out: './server/db/migrations',
});
