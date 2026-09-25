import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export const isGoogleAuthConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify a Google Identity Services ID token (signature, expiry, issuer and audience)
 * and return its payload. Throws if the token is invalid.
 */
export async function verifyGoogleIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}
