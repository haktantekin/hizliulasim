import { createHmac, randomUUID } from 'node:crypto';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export const DEFAULT_GOOGLE_CLIENT_ID = '208603820160-hbs70saa6umg9gbut6gs3g596vs8fjhh.apps.googleusercontent.com';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: true;
  name: string;
  picture: string;
}

export interface GoogleBridgeRequest {
  body: string;
  timestamp: string;
  signature: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function validateGoogleCredentialInput(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Google kimliği geçersiz.');
  const credential = value.trim();
  if (!credential || credential.length > 8192 || credential.split('.').length !== 3) {
    throw new Error('Google kimliği geçersiz.');
  }
  return credential;
}

export function normalizeGooglePayload(payload: Partial<TokenPayload> | Record<string, unknown>): GoogleIdentity {
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const verified = payload.email_verified === true;
  if (!sub || sub.length > 255 || !email || email.length > 254 || !EMAIL_PATTERN.test(email) || !verified) {
    throw new Error('Google hesabı doğrulanamadı.');
  }

  const suppliedName = typeof payload.name === 'string' ? payload.name.trim() : '';
  const fallbackName = email.slice(0, email.indexOf('@'));
  const name = (suppliedName || fallbackName).slice(0, 120);
  const suppliedPicture = typeof payload.picture === 'string' ? payload.picture.trim() : '';
  let picture = '';
  if (suppliedPicture && suppliedPicture.length <= 2048) {
    try {
      const url = new URL(suppliedPicture);
      if (url.protocol === 'https:') picture = url.toString();
    } catch {
      picture = '';
    }
  }

  return { sub, email, emailVerified: true, name, picture };
}

export async function verifyGoogleCredential(credential: string, clientId: string): Promise<GoogleIdentity> {
  const validCredential = validateGoogleCredentialInput(credential);
  if (!clientId.trim()) throw new Error('Google girişi yapılandırılmamış.');

  try {
    const ticket = await new OAuth2Client().verifyIdToken({
      idToken: validCredential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('missing payload');
    return normalizeGooglePayload(payload);
  } catch {
    throw new Error('Google hesabı doğrulanamadı.');
  }
}

export function buildGoogleBridgeRequest(
  identity: GoogleIdentity,
  secret: string,
  now: number,
  nonce: string = randomUUID(),
): GoogleBridgeRequest {
  if (secret.length < 32) throw new Error('Google giriş köprüsü yapılandırılmamış.');
  const issuedAt = Math.floor(now);
  const body = JSON.stringify({
    version: 1,
    sub: identity.sub,
    email: identity.email,
    emailVerified: identity.emailVerified,
    name: identity.name,
    picture: identity.picture,
    issuedAt,
    expiresAt: issuedAt + 60,
    nonce,
  });

  return {
    body,
    timestamp: String(issuedAt),
    signature: createHmac('sha256', secret).update(body, 'utf8').digest('base64url'),
  };
}
