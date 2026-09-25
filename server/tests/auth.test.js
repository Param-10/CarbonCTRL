import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { useTestDatabase } from './helpers/db.js';
import User from '../models/User.js';
import CompanyProfile from '../models/CompanyProfile.js';
import CarbonActivity from '../models/CarbonActivity.js';
import CarbonAssessment from '../models/CarbonAssessment.js';
import Emission from '../models/Emission.js';
import { verifyGoogleIdToken } from '../services/googleAuth.js';

// Google's token verification is the only external call; everything else runs for real
vi.mock('../services/googleAuth.js', () => ({
  isGoogleAuthConfigured: () => true,
  verifyGoogleIdToken: vi.fn()
}));

useTestDatabase();

afterEach(() => {
  vi.clearAllMocks();
});

const PASSWORD = 'secret123';
const NAME = 'Ada Lovelace';

const signUp = async (email = 'user@example.com', password = PASSWORD) => {
  const res = await request(app).post('/api/auth/signup').send({ name: NAME, email, password });
  expect(res.status).toBe(201);
  return res.body.token;
};

const authed = (method, path, token) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`);

const googlePayload = (overrides = {}) => ({
  sub: 'google-sub-123',
  email: 'jane@gmail.com',
  email_verified: true,
  name: 'Jane Doe',
  given_name: 'Jane',
  family_name: 'Doe',
  ...overrides
});

const googleSignIn = (credential = 'google-id-token') =>
  request(app).post('/api/auth/google').send({ credential });

describe('email/password auth', () => {
  it('signs in regardless of email casing', async () => {
    await signUp('Mixed.Case@Example.com');

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'mixed.case@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects non-string credentials instead of querying with them', async () => {
    await signUp();

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: { $ne: null }, password: PASSWORD });

    expect(res.status).toBe(400);
  });

  it('rejects an invalid email address on sign-up', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: NAME, email: 'not-an-email', password: PASSWORD });

    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects passwords longer than bcrypt can hash', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: NAME, email: 'user@example.com', password: 'a'.repeat(73) });

    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it('returns a clean error when two sign-ups for one email race', async () => {
    const attempt = () => request(app)
      .post('/api/auth/signup')
      .send({ name: NAME, email: 'race@example.com', password: PASSWORD });

    const statuses = (await Promise.all([attempt(), attempt()])).map((res) => res.status).sort();

    expect(statuses).toEqual([201, 400]);
    expect(await User.countDocuments()).toBe(1);
  });

  it('stores only a bcrypt hash of the password', async () => {
    await signUp();

    const user = await User.findOne({ email: 'user@example.com' });

    expect(user.password).not.toBe(PASSWORD);
    expect(user.password).toMatch(/^\$2[aby]\$12\$/);
  });

  it('requires a name on sign-up', async () => {
    for (const name of [undefined, '', '   ', 'x'.repeat(101), { $ne: null }]) {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name, email: 'user@example.com', password: PASSWORD });
      expect(res.status, JSON.stringify(name)).toBe(400);
    }
    expect(await User.countDocuments()).toBe(0);
  });

  it('stores the name, trimmed and with single spaces', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '  Ada   Lovelace ', email: 'user@example.com', password: PASSWORD });

    expect(res.body.user.name).toBe('Ada Lovelace');
    expect((await User.findOne({ email: 'user@example.com' })).name).toBe('Ada Lovelace');
  });

  it('never exposes the password hash or token version in the session payload', async () => {
    const token = await signUp();

    const res = await authed('get', '/api/auth/session', token);

    expect(res.status).toBe(200);
    const user = res.body.session.user;
    expect(user.password).toBeUndefined();
    expect(user.tokenVersion).toBeUndefined();
    expect(user.hasPassword).toBe(true);
  });

  it('does not accept a token signed with a different secret', async () => {
    const user = await User.create({ email: 'user@example.com', password: PASSWORD });
    const forged = jwt.sign({ userId: user._id, tokenVersion: 0 }, 'not-the-secret');

    const res = await authed('get', '/api/auth/session', forged);

    expect(res.status).toBe(401);
  });
});

describe('Google sign-in', () => {
  it('rejects a request without a credential', async () => {
    const res = await request(app).post('/api/auth/google').send({});

    expect(res.status).toBe(400);
    expect(verifyGoogleIdToken).not.toHaveBeenCalled();
  });

  it('rejects a credential Google does not verify and creates no user', async () => {
    verifyGoogleIdToken.mockRejectedValue(new Error('Wrong number of segments'));

    const res = await googleSignIn('junk');

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
    expect(await User.countDocuments()).toBe(0);
  });

  it('falls back to given and family name when Google sends no full name', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload({ name: undefined }));

    const res = await googleSignIn();

    expect(res.body.user.name).toBe('Jane Doe');
  });

  it('rejects a Google account whose email is not verified', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload({ email_verified: false }));

    const res = await googleSignIn();

    expect(res.status).toBe(401);
    expect(await User.countDocuments()).toBe(0);
  });

  it('creates the user from the Google profile on first sign-in', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());

    const res = await googleSignIn();

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({
      email: 'jane@gmail.com',
      name: 'Jane Doe',
      isEmailVerified: true,
      hasPassword: false
    });
  });

  it('returns the same account on every sign-in with the same Google account', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());

    const first = await googleSignIn();
    const second = await googleSignIn();

    expect(second.body.user._id).toBe(first.body.user._id);
    expect(await User.countDocuments()).toBe(1);
  });

  it('links Google to an existing email/password account with the same email', async () => {
    await signUp('jane@gmail.com');
    verifyGoogleIdToken.mockResolvedValue(googlePayload({ email: 'Jane@Gmail.com' }));

    const res = await googleSignIn();

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(1);
    const user = await User.findOne({ email: 'jane@gmail.com' });
    expect(user.googleId).toBe('google-sub-123');
    expect(user.password).toBeTruthy();
  });

  it('refuses to link an email already linked to a different Google account', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());
    await googleSignIn();

    verifyGoogleIdToken.mockResolvedValue(googlePayload({ sub: 'another-google-sub' }));
    const res = await googleSignIn();

    expect(res.status).toBe(409);
    expect(await User.countDocuments()).toBe(1);
  });

  it('does not let a Google-only account sign in with a password', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());
    await googleSignIn();

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'jane@gmail.com', password: 'anything' });

    expect(res.status).toBe(401);
  });
});

describe('password change', () => {
  it('rejects a new password without the current password', async () => {
    const token = await signUp();

    const res = await authed('put', '/api/auth/user', token).send({ password: 'newpass123' });

    expect(res.status).toBe(400);
  });

  it('rejects a wrong current password', async () => {
    const token = await signUp();

    const res = await authed('put', '/api/auth/user', token)
      .send({ password: 'newpass123', currentPassword: 'wrong-password' });

    expect(res.status).toBe(400);
  });

  it('changes the password when the current password is correct', async () => {
    const token = await signUp();

    const res = await authed('put', '/api/auth/user', token)
      .send({ password: 'newpass123', currentPassword: PASSWORD });
    expect(res.status).toBe(200);

    const signIn = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'user@example.com', password: 'newpass123' });
    expect(signIn.status).toBe(200);
  });

  it('signs out other sessions and returns a working token to the caller', async () => {
    const token = await signUp();
    const otherDevice = (await request(app)
      .post('/api/auth/signin')
      .send({ email: 'user@example.com', password: PASSWORD })).body.token;

    const res = await authed('put', '/api/auth/user', token)
      .send({ password: 'newpass123', currentPassword: PASSWORD });

    expect(res.body.token).toBeTruthy();
    expect((await authed('get', '/api/auth/session', res.body.token)).status).toBe(200);
    expect((await authed('get', '/api/auth/session', token)).status).toBe(401);
    expect((await authed('get', '/api/auth/session', otherDevice)).status).toBe(401);
  });

  it('keeps sessions and returns no token when only the name changes', async () => {
    const token = await signUp();

    const res = await authed('put', '/api/auth/user', token).send({ name: 'Ada King' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect((await authed('get', '/api/auth/session', token)).status).toBe(200);
  });

  it('updates the name and rejects a blank one', async () => {
    const token = await signUp();

    const blank = await authed('put', '/api/auth/user', token).send({ name: '  ' });
    expect(blank.status).toBe(400);

    const res = await authed('put', '/api/auth/user', token).send({ name: 'Ada King' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Ada King');
  });

  it('lets a Google-only user set a first password without a current one', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());
    const google = await googleSignIn();

    const res = await authed('put', '/api/auth/user', google.body.token).send({ password: 'newpass123' });

    expect(res.status).toBe(200);
    expect(res.body.user.hasPassword).toBe(true);
  });
});

describe('account deletion', () => {
  const seedUserData = async (token) => {
    await authed('post', '/api/company/profile', token)
      .send({ name: 'Acme', industry: 'Technology', employees: '11-50', location: 'Austin, TX' });
    await authed('post', '/api/carbon/activity', token)
      .send({ sector: 'power', subsector: 'electricity-generation', activityAmount: 100, activityUnit: 'kWh' });
    const assessment = await authed('get', '/api/carbon/assessment', token);
    await authed('put', `/api/carbon/assessment/${assessment.body._id}`, token)
      .send({ totalEmissions: 45, grade: 'B', emissionsBreakdown: { power: 45 } });
  };

  it('keeps everything when the password is wrong', async () => {
    const token = await signUp();
    await seedUserData(token);

    const res = await authed('delete', '/api/auth/user', token).send({ password: 'wrong-password' });

    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(1);
    expect(await CarbonActivity.countDocuments()).toBe(1);
  });

  it('deletes the user and all of their data, and only theirs', async () => {
    const token = await signUp();
    await seedUserData(token);
    const otherToken = await signUp('other@example.com');
    await seedUserData(otherToken);

    const res = await authed('delete', '/api/auth/user', token).send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(1);
    expect(await CompanyProfile.countDocuments()).toBe(1);
    expect(await CarbonActivity.countDocuments()).toBe(1);
    expect(await CarbonAssessment.countDocuments()).toBe(1);
    // The other user's breakdown row plus their total row
    expect(await Emission.countDocuments()).toBe(2);

    const session = await authed('get', '/api/auth/session', token);
    expect(session.status).toBe(401);
  });

  it('lets a Google-only user delete their account', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());
    const google = await googleSignIn();

    const res = await authed('delete', '/api/auth/user', google.body.token).send({});

    expect(res.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('documents written by older versions', () => {
  it('shows a name built from the old first and last name fields', async () => {
    const token = await signUp();
    await User.collection.updateOne(
      { email: 'user@example.com' },
      { $unset: { name: '' }, $set: { firstName: 'Grace', lastName: 'Hopper' } }
    );

    const res = await authed('get', '/api/auth/session', token);

    expect(res.body.session.user.name).toBe('Grace Hopper');
    expect(res.body.session.user.firstName).toBeUndefined();
  });
});

describe('removed two-factor authentication', () => {
  it('no longer exposes 2FA endpoints', async () => {
    const token = await signUp();

    for (const path of ['/api/auth/2fa/setup', '/api/auth/2fa/verify', '/api/auth/2fa/disable', '/api/auth/2fa/login']) {
      const res = await authed('post', path, token).send({});
      expect(res.status, path).toBe(404);
    }
  });

  it('signs in accounts that had 2FA enabled before it was removed', async () => {
    await signUp();
    // Simulate a document written while 2FA existed
    await User.collection.updateOne(
      { email: 'user@example.com' },
      { $set: { twoFactorEnabled: true, twoFactorSecret: 'LEGACYSECRET' } }
    );

    const res = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'user@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.twoFactorSecret).toBeUndefined();
    expect(res.body.user.twoFactorEnabled).toBeUndefined();
  });
});
