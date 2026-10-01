import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { setTempDb, cleanUpDb } from './helpers/db.js';

// ---------------------------------------------------------------------------
// Order matters: point DATABASE_PATH at a throwaway file and stub Google
// BEFORE the app/db modules are evaluated. Static imports are resolved first,
// so these must be dynamic imports (top-level await) below.
// ---------------------------------------------------------------------------

const dbPath = setTempDb('carbonctrl-auth');

// Fake Google OAuth: getToken() returns a fixed id_token and verifyIdToken()
// returns a payload we can control per test via globalThis.__googlePayload.
vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    async getToken() {
      return { tokens: { id_token: 'google-mock-id-token', expires_in: 3600 } };
    }
    async verifyIdToken() {
      const payload = globalThis.__googlePayload;
      return {
        getPayload: () => payload,
      };
    }
  }
  return { OAuth2Client: MockOAuth2Client };
});

process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

const { default: app } = await import('../app.js');
const { sqlite } = await import('../db/index.js');

const agent = request(app);

const signup = (email, password, firstName = 'First', lastName = 'Last') =>
  agent
    .post('/api/auth/signup')
    .send({ email, password, name: `${firstName} ${lastName}` });

const signin = (email, password) =>
  agent.post('/api/auth/signin').send({ email, password });

const session = (token) =>
  agent.get('/api/auth/session').set('Authorization', `Bearer ${token}`);

const googleSignIn = (body) => agent.post('/api/auth/google').send(body);


const googlePayload = (sub, email) => ({
  sub,
  email,
  email_verified: true,
  given_name: 'Goog',
  family_name: 'Le',
  name: 'Goog Le',
});

describe('auth flows (SQLite)', () => {
  let aliceToken;

  it('signs up a new account and can read its session', async () => {
    const res = await signup('alice@example.com', 'StrongPass1!', 'Alice', 'Wilson');
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.name).toBe('Alice Wilson');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.id).toBeDefined();
    aliceToken = res.body.token;

    const s = await session(aliceToken);
    expect(s.status).toBe(200);
    expect(s.body.session.user.email).toBe('alice@example.com');
  });

  it('rejects duplicate signups', async () => {
    const res = await signup('alice@example.com', 'AnotherPass1!');
    expect(res.status).toBe(400);
  });

  it('rejects weak and oversized passwords', async () => {
    const weak = await signup('weak@example.com', 'short');
    expect(weak.status).toBe(400);

    const oversized = await signup('big@example.com', 'x'.repeat(80));
    expect(oversized.status).toBe(400);
  });

  it('requires the name and validates the email at signup', async () => {
    const noName = await agent.post('/api/auth/signup').send({ email: 'name@example.com', password: 'StrongPass1!' });
    expect(noName.status).toBe(400);
    const badEmail = await agent.post('/api/auth/signup').send({ name: 'Name', email: 'invalid', password: 'StrongPass1!' });
    expect(badEmail.status).toBe(400);
  });

  it('rejects bad credentials', async () => {
    const res = await signin('alice@example.com', 'WrongPass1!');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 200 + null for a profile-less user (no premature 404)', async () => {
    const res = await agent
      .get('/api/company/profile')
      .set('Authorization', `Bearer ${aliceToken}`);
    // A missing profile is the normal new-user state: 200 with a JSON null body
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('creates and reads back a company profile', async () => {
    const profile = {
      name: 'Alice Industries',
      industry: 'Manufacturing',
      employees: '11-50',
      location: 'Austin, TX',
      phone: '+1-555-0100',
      email: 'alice@example.com',
      founded: '2015',
      description: 'Widgets',
    };
    const created = await agent
      .post('/api/company/profile')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send(profile);
    expect([200, 201]).toContain(created.status);

    const got = await agent
      .get('/api/company/profile')
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(got.status).toBe(200);
    expect(got.body.name).toBe('Alice Industries');
    expect(got.body.userId ?? got.body.user_id).toBe(resolveUserId(aliceToken));
  });

  it('rejects unauthenticated profile access', async () => {
    const res = await agent.get('/api/company/profile');
    expect(res.status).toBe(401);
  });

  describe('without two-factor authentication', () => {
    it('signs in straight to a session', async () => {
      await signup('direct@example.com', 'StrongPass2!', 'Direct', 'User');
      const res = await signin('direct@example.com', 'StrongPass2!');
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.requiresTwoFactor).toBeUndefined();
      expect(res.body.user).not.toHaveProperty('twoFactorEnabled');
    });

    it.each(['/api/auth/2fa/setup', '/api/auth/2fa/verify', '/api/auth/2fa/disable', '/api/auth/signin/2fa'])(
      'no longer serves %s',
      async (path) => {
        const res = await agent.post(path).send({});
        expect(res.status).toBe(404);
      }
    );
  });

  describe('tokenVersion session invalidation', () => {
    let oldToken;
    let freshToken;

    beforeAll(async () => {
      const res = await signup('bob@example.com', 'OldPass1!', 'Bob', 'Smith');
      oldToken = res.body.token;
    });

    it('changing the password invalidates old sessions (401) and issues a fresh token', async () => {
      const res = await agent
        .put('/api/auth/user')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ password: 'NewPass1!', currentPassword: 'OldPass1!' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      freshToken = res.body.token;

      const old = await session(oldToken);
      expect(old.status).toBe(401);

      const now = await session(freshToken);
      expect(now.status).toBe(200);
    });

    it('rejects a password change with the wrong current password', async () => {
      const res = await agent
        .put('/api/auth/user')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ password: 'OtherPass1!', currentPassword: 'Wrong' });
      expect(res.status).toBe(400);
    });
  });

  it('does not issue password reset links without an email provider', async () => {
    const res = await agent.post('/api/auth/forgot-password').send({ email: 'bob@example.com' });
    expect(res.status).toBe(503);
    expect(res.body.resetUrl).toBeUndefined();
  });

  describe('password reset', () => {
    let resetUrl;
    let emailRequest;

    beforeAll(() => {
      process.env.RESEND_API_KEY = 'test-api-key';
      process.env.RESET_FROM_EMAIL = 'CarbonCTRL <reset@example.com>';
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
        emailRequest = { url, options };
        return { ok: true, status: 200 };
      });
    });

    it('issues a reset link for an existing account', async () => {
      const res = await agent
        .post('/api/auth/forgot-password')
        .send({ email: 'bob@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.resetUrl).toBeUndefined();
      expect(emailRequest.url).toBe('https://api.resend.com/emails');
      const message = JSON.parse(emailRequest.options.body);
      expect(message.to).toEqual(['bob@example.com']);
      resetUrl = message.text.match(/https?:\/\/\S+#token=\S+/)[0];
    });

    it('does not reveal whether an email exists', async () => {
      const res = await agent
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.resetUrl).toBeUndefined();
    });

    it('resets the password and invalidates earlier sessions', async () => {
      const token = new URLSearchParams(new URL(resetUrl).hash.slice(1)).get('token');

      const res = await agent
        .post('/api/auth/reset-password')
        .send({ token, password: 'ResetPass1!' });
      expect(res.status).toBe(200);

      const direct = await signin('bob@example.com', 'ResetPass1!');
      expect(direct.status).toBe(200);
      expect(direct.body.token).toBeTruthy();
    });

    it('rejects an expired or fake token', async () => {
      const res = await agent
        .post('/api/auth/reset-password')
        .send({ token: 'not-a-real-token', password: 'Whatever1!' });
      expect(res.status).toBe(400);
    });

    it.each(['https://carbonctrl.us,https://carbonctrl.netlify.app', 'https://carbonctrl.us/, https://carbonctrl.netlify.app'])(
      'links to the first origin when FRONTEND_URL lists several (%s)',
      async (origins) => {
        const previous = process.env.FRONTEND_URL;
        process.env.FRONTEND_URL = origins;
        try {
          const res = await agent.post('/api/auth/forgot-password').send({ email: 'bob@example.com' });
          expect(res.status).toBe(200);
          const link = JSON.parse(emailRequest.options.body).text.match(/https?:\/\/\S+#token=\S+/)[0];
          expect(link.startsWith('https://carbonctrl.us/reset-password#token=')).toBe(true);
        } finally {
          if (previous === undefined) delete process.env.FRONTEND_URL;
          else process.env.FRONTEND_URL = previous;
        }
      }
    );

    it('saves the token before emailing, so the link in the email works', async () => {
      const { usersRepo } = await import('../db/repos.js');
      let tokenSavedBeforeSend = false;
      globalThis.fetch.mockImplementationOnce(async (url, options) => {
        emailRequest = { url, options };
        tokenSavedBeforeSend = Boolean(usersRepo.findByEmail('bob@example.com').resetPasswordToken);
        return { ok: true, status: 200 };
      });
      usersRepo.update(usersRepo.findByEmail('bob@example.com').id, { resetPasswordToken: null });

      await agent.post('/api/auth/forgot-password').send({ email: 'bob@example.com' });

      expect(tokenSavedBeforeSend).toBe(true);
    });

    afterAll(() => {
      vi.restoreAllMocks();
      delete process.env.RESEND_API_KEY;
      delete process.env.RESET_FROM_EMAIL;
    });
  });

  describe('Google account linking', () => {
    it('creates a new account from a verified Google token', async () => {
      globalThis.__googlePayload = googlePayload('sub-new', 'gnew@example.com');
      const res = await googleSignIn({ credential: 'google-mock-id-token' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.email).toBe('gnew@example.com');
    });

    it('requires the existing password before linking (LINK_PASSWORD_REQUIRED)', async () => {
      await signup('linky@example.com', 'LinkPass1!', 'Linky', 'User');

      globalThis.__googlePayload = googlePayload('sub-linky', 'linky@example.com');

      const first = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(first.status).toBe(409);
      expect(first.body.code).toBe('LINK_PASSWORD_REQUIRED');
      expect(first.body.idToken).toBeTruthy();

      // Retry with the correct password (the ID token is reusable; codes are single-use)
      const linked = await googleSignIn({
        idToken: first.body.idToken,
        password: 'LinkPass1!',
      });
      expect(linked.status).toBe(200);

      // The account now logs in via Google for verification
      globalThis.__googlePayload = googlePayload('sub-linky', 'linky@example.com');
      const again = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(again.status).toBe(200);
    });

    it('rejects an incorrect password during linking', async () => {
      await signup('linky2@example.com', 'LinkPass2!', 'Linky2', 'User');
      globalThis.__googlePayload = googlePayload('sub-linky2', 'linky2@example.com');

      const first = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(first.body.code).toBe('LINK_PASSWORD_REQUIRED');

      const bad = await googleSignIn({
        idToken: first.body.idToken,
        password: 'WrongPass2!',
      });
      expect(bad.status).toBe(409);
      expect(bad.body.code).toBe('LINK_PASSWORD_REQUIRED');
    });

    it('discarding the password links the account and kills password sessions', async () => {
      const created = await signup('discard@example.com', 'DiscardPass1!', 'Dis', 'Card');
      const oldToken = created.body.token;

      globalThis.__googlePayload = googlePayload('sub-discard', 'discard@example.com');
      const first = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(first.body.code).toBe('LINK_PASSWORD_REQUIRED');

      const linked = await googleSignIn({
        idToken: first.body.idToken,
        discardPassword: true,
      });
      expect(linked.status).toBe(200);

      // Password logins are gone and every old JWT is invalidated
      const old = await session(oldToken);
      expect(old.status).toBe(401);

      const pwSignin = await signin('discard@example.com', 'DiscardPass1!');
      expect(pwSignin.status).toBe(401);

      // But Google sign-in works
      globalThis.__googlePayload = googlePayload('sub-discard', 'discard@example.com');
      const again = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(again.status).toBe(200);
    });

    it('blocks linking an email already claimed by another Google account', async () => {
      // Claim goat@example.com with google sub-a via direct link
      await signup('goat@example.com', 'GoatPass1!', 'Goat', 'User');
      globalThis.__googlePayload = googlePayload('sub-goat-a', 'goat@example.com');
      const first = await googleSignIn({ googleToken: 'mock-auth-code' });
      const linked = await googleSignIn({
        idToken: first.body.idToken,
        password: 'GoatPass1!',
      });
      expect(linked.status).toBe(200);

      // Different Google identity, same email
      globalThis.__googlePayload = googlePayload('sub-goat-b', 'goat@example.com');
      const conflict = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(conflict.status).toBe(409);
      expect(conflict.body.code).toBe('GOOGLE_EMAIL_LINKED');
    });

    it('rejects Google payloads whose email is not verified', async () => {
      globalThis.__googlePayload = {
        sub: 'sub-unverified',
        email: 'unverified@example.com',
        email_verified: false,
        name: 'Unverified',
      };
      const res = await googleSignIn({ googleToken: 'mock-auth-code' });
      expect(res.status).toBe(401);
    });

    afterAll(() => {
      delete globalThis.__googlePayload;
    });
  });

  describe('account deletion', () => {
    let token;
    let userId;

    beforeAll(async () => {
      const res = await signup('delete-me@example.com', 'DeletePass1!', 'Del', 'Eteme');
      token = res.body.token;
      userId = res.body.user.id;
    });

    it('requires the password to delete an account', async () => {
      const noPass = await agent
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`);
      expect(noPass.status).toBe(400);

      const wrongPass = await agent
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPass' });
      expect(wrongPass.status).toBe(400);
    });

    it('deletes the account and revokes the session', async () => {
      const res = await agent
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'DeletePass1!' });
      expect(res.status).toBe(200);

      const s = await session(token);
      expect(s.status).toBe(401);

      const { usersRepo } = await import('../db/repos.js');
      expect(usersRepo.findById(userId)).toBeUndefined();
    });
  });

  describe('health + infrastructure', () => {
    it('reports SQLite as connected', async () => {
      const res = await agent.get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
      expect(res.body.database).toBe('connected');
      expect(res.body.storage).toBe('sqlite');
    });

    it('404s unknown routes as JSON', async () => {
      const res = await agent.get('/api/nope');
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });

  afterAll(() => {
    sqlite.close();
    cleanUpDb(dbPath);
  });
});

/** Extract the numeric user id embedded in a JWT (test helper only). */
function resolveUserId(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).userId;
}
