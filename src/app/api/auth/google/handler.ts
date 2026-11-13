import { randomUUID } from 'node:crypto';
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  buildGoogleBridgeRequest,
  validateGoogleCredentialInput,
  verifyGoogleCredential,
  type GoogleIdentity,
} from '../../../../lib/auth/google.ts';

interface GoogleAuthConfig {
  clientId: string;
  bridgeSecret: string;
  wpApi: string;
}

interface GoogleAuthDependencies {
  config?: GoogleAuthConfig;
  verifyCredential?: (credential: string, clientId: string) => Promise<GoogleIdentity>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  nonce?: () => string;
}

interface WordPressAuthResponse {
  user: Record<string, unknown>;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

const SECURE_COOKIE = process.env.NODE_ENV === 'production';

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function authCookie(name: string, value: string, maxAge: number) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.floor(maxAge)}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (SECURE_COOKIE) parts.push('Secure');
  return parts.join('; ');
}

function getConfig(): GoogleAuthConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim()
      || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
      || DEFAULT_GOOGLE_CLIENT_ID,
    bridgeSecret: process.env.GOOGLE_AUTH_BRIDGE_SECRET?.trim() || '',
    wpApi: (process.env.NEXT_PUBLIC_WP_API_URL?.replace(/\/wp\/v2\/?$/u, '')
      || 'https://cms.hizliulasim.com/wp-json').replace(/\/$/u, ''),
  };
}

function isValidConfig(config: GoogleAuthConfig) {
  if (!config.clientId || config.bridgeSecret.length < 32) return false;
  try {
    const url = new URL(config.wpApi);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:');
  } catch {
    return false;
  }
}

function isWordPressAuthResponse(value: unknown): value is WordPressAuthResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WordPressAuthResponse>;
  const tokens = candidate.tokens;
  return Boolean(candidate.user && typeof candidate.user === 'object'
    && tokens && typeof tokens === 'object'
    && typeof tokens.access_token === 'string' && tokens.access_token
    && typeof tokens.refresh_token === 'string' && tokens.refresh_token
    && Number.isInteger(tokens.expires_in) && tokens.expires_in > 0);
}

export function createGoogleAuthPost(dependencies: GoogleAuthDependencies = {}) {
  const config = dependencies.config ?? getConfig();
  const verifyCredential = dependencies.verifyCredential ?? verifyGoogleCredential;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const nonce = dependencies.nonce ?? randomUUID;

  return async function post(request: Request) {
    if (!isValidConfig(config)) {
      return json({ message: 'Google ile giriş şu anda kullanılamıyor.' }, 503);
    }

    let credential: string;
    try {
      if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        throw new Error('invalid content type');
      }
      const declaredLength = Number(request.headers.get('content-length') || 0);
      if (declaredLength > 12_000) throw new Error('oversized body');
      const rawBody = await request.text();
      if (rawBody.length > 12_000) throw new Error('oversized body');
      const body = JSON.parse(rawBody);
      credential = validateGoogleCredentialInput(body?.credential);
    } catch {
      return json({ message: 'Google kimliği geçersiz.' }, 400);
    }

    let identity: GoogleIdentity;
    try {
      identity = await verifyCredential(credential, config.clientId);
    } catch {
      return json({ message: 'Google hesabı doğrulanamadı.' }, 401);
    }

    let upstream: Response;
    try {
      const bridge = buildGoogleBridgeRequest(identity, config.bridgeSecret, now(), nonce());
      upstream = await fetchImpl(`${config.wpApi}/hizliulasim/v1/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hizliulasim-Timestamp': bridge.timestamp,
          'X-Hizliulasim-Signature': bridge.signature,
        },
        body: bridge.body,
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return json({ message: 'Google ile giriş tamamlanamadı.' }, 502);
    }

    const data: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const upstreamCode = data && typeof data === 'object' && 'code' in data
        ? String((data as { code?: unknown }).code)
        : '';
      if (upstream.status === 409 && upstreamCode === 'account_link_required') {
        return json({
          message: 'Bu e-posta ile kayıtlı bir hesap var. Güvenliğiniz için e-posta ve şifrenizle giriş yapın.',
          code: 'account_link_required',
        }, 409);
      }
      return json(
        { message: 'Google ile giriş tamamlanamadı.' },
        upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502,
      );
    }

    if (!isWordPressAuthResponse(data)) {
      return json({ message: 'Google ile giriş tamamlanamadı.' }, 502);
    }

    const response = json({ user: data.user });
    response.headers.append('Set-Cookie', authCookie('auth_token', data.tokens.access_token, data.tokens.expires_in));
    response.headers.append('Set-Cookie', authCookie('refresh_token', data.tokens.refresh_token, 30 * 24 * 60 * 60));
    return response;
  };
}
