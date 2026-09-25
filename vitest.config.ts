import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.js'],
    environment: 'node',
    // The first run downloads a MongoDB binary for mongodb-memory-server
    hookTimeout: 120000,
    env: {
      JWT_SECRET: 'test-jwt-secret',
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com'
    }
  }
});
