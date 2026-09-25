import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '../app.js';
import { useTestDatabase } from './helpers/db.js';

useTestDatabase();

const signUp = async () => {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Ada Lovelace', email: 'user@example.com', password: 'secret123' });
  return res.body.token;
};

describe('company profile', () => {
  it('returns null, not an error, for a user without a profile', async () => {
    const token = await signUp();

    const res = await request(app)
      .get('/api/company/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the saved profile', async () => {
    const token = await signUp();
    await request(app)
      .post('/api/company/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme', industry: 'Technology', employees: '11-50', location: 'Austin, TX' });

    const res = await request(app)
      .get('/api/company/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Acme', industry: 'Technology' });
  });
});
