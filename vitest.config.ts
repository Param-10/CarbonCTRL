import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.js'],
    environment: 'node',
    // better-sqlite3 native bindings and the test DB boot can be slow on first run
    hookTimeout: 120000,
    env: {
      JWT_SECRET: 'test-jwt-secret',
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret'
    }
  }
});