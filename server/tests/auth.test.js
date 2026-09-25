import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import speakeasy from 'speakeasy';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../app.js';
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

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Build unique indexes before tests rely on them
  await User.syncIndexes();
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const PASSWORD = 'secret123';

const totp = (secret, time) => speakeasy.totp({ secret, encoding: 'base32', ...(time && { time }) });
// A code from an hour ago is outside the verification window
const staleTotp = (secret) => totp(secret, Math.floor(Date.now() / 1000) - 3600);

const signUp = async (email = 'user@example.com', password = PASSWORD) => {
  const res = await request(app).post('/api/auth/signup').send({ email, password });
  expect(res.status).toBe(201);
  return res.body.token;
};

const authed = (method, path, token) =>
  request(app)[method](path).set('Authorization', `Bearer ${token}`);

const enableTwoFactor = async (token) => {
  const setup = await authed('post', '/api/auth/2fa/setup', token);
  expect(setup.status).toBe(200);
  const secret = setup.body.manualEntryKey;

  const verify = await authed('post', '/api/auth/2fa/verify', token).send({ code: totp(secret) });
  expect(verify.status).toBe(200);
  return secret;
};

const googlePayload = (overrides = {}) => ({
  sub: 'google-sub-123',
  email: 'jane@gmail.com',
  email_verified: true,
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

  it('never exposes secrets in the session payload', async () => {
    const token = await signUp();
    await enableTwoFactor(token);

    const res = await authed('get', '/api/auth/session', token);

    expect(res.status).toBe(200);
    const user = res.body.session.user;
    expect(user.password).toBeUndefined();
    expect(user.twoFactorSecret).toBeUndefined();
    expect(user.twoFactorTempSecret).toBeUndefined();
    expect(user.hasPassword).toBe(true);
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
      firstName: 'Jane',
      lastName: 'Doe',
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
});

describe('two-factor authentication', () => {
  it('does not enable 2FA with a wrong code', async () => {
    const token = await signUp();
    const setup = await authed('post', '/api/auth/2fa/setup', token);

    const res = await authed('post', '/api/auth/2fa/verify', token)
      .send({ code: staleTotp(setup.body.manualEntryKey) });

    expect(res.status).toBe(400);
    expect((await User.findOne()).twoFactorEnabled).toBe(false);
  });

  it('ignores a secret supplied by the client when verifying', async () => {
    const token = await signUp();
    await authed('post', '/api/auth/2fa/setup', token);
    const attackerSecret = speakeasy.generateSecret().base32;
    const attackerCode = totp(attackerSecret);

    // `token` is the field name the previous API read the code from
    const res = await authed('post', '/api/auth/2fa/verify', token)
      .send({ code: attackerCode, token: attackerCode, secret: attackerSecret });

    expect(res.status).toBe(400);
  });

  it('requires the code before issuing a session on password sign-in', async () => {
    const token = await signUp();
    const secret = await enableTwoFactor(token);

    const signIn = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'user@example.com', password: PASSWORD });

    expect(signIn.status).toBe(200);
    expect(signIn.body.twoFactorRequired).toBe(true);
    expect(signIn.body.token).toBeUndefined();

    const wrong = await request(app)
      .post('/api/auth/2fa/login')
      .send({ twoFactorToken: signIn.body.twoFactorToken, code: staleTotp(secret) });
    expect(wrong.status).toBe(401);

    const right = await request(app)
      .post('/api/auth/2fa/login')
      .send({ twoFactorToken: signIn.body.twoFactorToken, code: totp(secret) });
    expect(right.status).toBe(200);

    const session = await authed('get', '/api/auth/session', right.body.token);
    expect(session.status).toBe(200);
  });

  it('does not accept the pending 2FA token as a session token', async () => {
    const token = await signUp();
    await enableTwoFactor(token);
    const signIn = await request(app)
      .post('/api/auth/signin')
      .send({ email: 'user@example.com', password: PASSWORD });

    const res = await authed('get', '/api/auth/session', signIn.body.twoFactorToken);

    expect(res.status).toBe(401);
  });

  it('requires the code on Google sign-in too', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());
    const first = await googleSignIn();
    await enableTwoFactor(first.body.token);

    const res = await googleSignIn();

    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.token).toBeUndefined();
  });

  it('only disables 2FA with a valid code', async () => {
    const token = await signUp();
    const secret = await enableTwoFactor(token);

    const withoutCode = await authed('post', '/api/auth/2fa/disable', token).send({});
    expect(withoutCode.status).toBe(400);
    expect((await User.findOne()).twoFactorEnabled).toBe(true);

    const withCode = await authed('post', '/api/auth/2fa/disable', token).send({ code: totp(secret) });
    expect(withCode.status).toBe(200);
    expect((await User.findOne()).twoFactorEnabled).toBe(false);
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

  it('asks a Google-only user with 2FA for a code', async () => {
    verifyGoogleIdToken.mockResolvedValue(googlePayload());
    const google = await googleSignIn();
    const secret = await enableTwoFactor(google.body.token);

    const withoutCode = await authed('delete', '/api/auth/user', google.body.token).send({});
    expect(withoutCode.status).toBe(400);

    const withCode = await authed('delete', '/api/auth/user', google.body.token).send({ code: totp(secret) });
    expect(withCode.status).toBe(200);
    expect(await User.countDocuments()).toBe(0);
  });
});
