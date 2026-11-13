import { randomUUID } from 'node:crypto';
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  buildGoogleBridgeRequest,
  validateGoogleCredentialInput,
  verifyGoogleCredential,
  type GoogleIdentity,
} from '../../../../../lib/auth/google.ts';

interface GoogleLinkConfig {
  clientId: string;
  bridgeSecret: string;
  wpApi: string;
}

interface GoogleLinkDependencies {
  config?: GoogleLinkConfig;
  verifyCredential?: (credential: string, clientId: string) => Promise<GoogleIdentity>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  nonce?: () => string;
}

interface WordPressLinkResponse {
  linked: true;
  email: string;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function getConfig(): GoogleLinkConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim()
      || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
      || DEFAULT_GOOGLE_CLIENT_ID,
    bridgeSecret: process.env.GOOGLE_AUTH_BRIDGE_SECRET?.trim() || '',
    wpApi: (process.env.NEXT_PUBLIC_WP_API_URL?.replace(/\/wp\/v2\/?$/u, '')
      || 'https://cms.hizliulasim.com/wp-json').replace(/\/$/u, ''),
  };
}

function isValidConfig(config: GoogleLinkConfig) {
  if (!config.clientId || config.bridgeSecret.length < 32) return false;
  try {
    const url = new URL(config.wpApi);
    return url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:');
  } catch {
    return false;
  }
}

function isWordPressLinkResponse(value: unknown, expectedEmail: string): value is WordPressLinkResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WordPressLinkResponse>;
  return candidate.linked === true
    && typeof candidate.email === 'string'
    && candidate.email.toLowerCase() === expectedEmail.toLowerCase();
}

function safeUpstreamError(data: unknown, status: number) {
  const code = data && typeof data === 'object' && 'code' in data
    ? String((data as { code?: unknown }).code)
    : '';
  const conflictMessages: Record<string, string> = {
    google_email_mismatch: 'Google hesabının e-postası üyelik e-postanızla eşleşmiyor.',
    google_identity_in_use: 'Bu Google hesabı başka bir üyeliğe bağlı.',
    google_account_already_linked: 'Üyeliğiniz başka bir Google hesabına bağlı.',
  };
  if (status === 409 && conflictMessages[code]) {
    return json({ message: conflictMessages[code], code }, 409);
  }
  if (status === 401) {
    return json({ message: 'Google hesabını bağlamak için yeniden giriş yapın.' }, 401);
  }
  return json(
    { message: 'Google hesabı bağlanamadı.' },
    status >= 400 && status < 500 ? status : 502,
  );
}

export function createGoogleLinkPost(dependencies: GoogleLinkDependencies = {}) {
  const config = dependencies.config ?? getConfig();
  const verifyCredential = dependencies.verifyCredential ?? verifyGoogleCredential;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const nonce = dependencies.nonce ?? randomUUID;

  return async function post(request: Request, accessToken: string | undefined) {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token || token.length > 8192) {
      return json({ message: 'Google hesabını bağlamak için yeniden giriş yapın.' }, 401);
    }
    if (!isValidConfig(config)) {
      return json({ message: 'Google hesabı bağlama şu anda kullanılamıyor.' }, 503);
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
      credential = validateGoogleCredentialInput(JSON.parse(rawBody)?.credential);
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
      upstream = await fetchImpl(`${config.wpApi}/hizliulasim/v1/auth/google/link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Hizliulasim-Timestamp': bridge.timestamp,
          'X-Hizliulasim-Signature': bridge.signature,
        },
        body: bridge.body,
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return json({ message: 'Google hesabı bağlanamadı.' }, 502);
    }

    const data: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) return safeUpstreamError(data, upstream.status);
    if (!isWordPressLinkResponse(data, identity.email)) {
      return json({ message: 'Google hesabı bağlanamadı.' }, 502);
    }
    return json(data);
  };
}
