import { createHash } from 'node:crypto';
import { normalizeIettStaticCode } from '../lib/iett-static/contracts.ts';
import type { IETTHatOtoKonum } from '../types/iett.ts';

export type LiveSessionStatus = 'valid' | 'invalid' | 'unavailable';

interface LiveVehicleDependencies {
  verifySession(token: string): Promise<LiveSessionStatus>;
  getLocations(lineCode: string): Promise<IETTHatOtoKonum[]>;
}

interface CachedSession {
  status: Exclude<LiveSessionStatus, 'unavailable'>;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const maxSessionCacheEntries = 256;
const validSessionTtlMs = 60_000;
const invalidSessionTtlMs = 15_000;
const authTimeoutMs = 5_000;

function response(body: object | IETTHatOtoKonum[], status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  const prefix = `${name}=`;
  const raw = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
  if (!raw || raw.length > 8192) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function sessionKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function rememberSession(key: string, value: CachedSession): void {
  if (sessionCache.size >= maxSessionCacheEntries && !sessionCache.has(key)) {
    sessionCache.delete(sessionCache.keys().next().value as string);
  }
  sessionCache.set(key, value);
}

export async function verifyLiveIettSession(token: string): Promise<LiveSessionStatus> {
  const key = sessionKey(token);
  const now = Date.now();
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > now) return cached.status;
  if (cached) sessionCache.delete(key);

  const wpApi = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), authTimeoutMs);
  try {
    const authResponse = await fetch(`${wpApi}/hizliulasim/v1/auth/me`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
    });
    if (authResponse.ok) {
      rememberSession(key, { status: 'valid', expiresAt: now + validSessionTtlMs });
      return 'valid';
    }
    if (authResponse.status === 401 || authResponse.status === 403) {
      rememberSession(key, { status: 'invalid', expiresAt: now + invalidSessionTtlMs });
      return 'invalid';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}

export function createLiveVehicleHandler(dependencies: LiveVehicleDependencies) {
  return async function getLiveVehicles(request: Request): Promise<Response> {
    const lineCode = normalizeIettStaticCode(new URL(request.url).searchParams.get('hatKodu') ?? '');
    if (lineCode === null) {
      return response({ error: 'Geçerli bir hatKodu parametresi gerekli' }, 400);
    }

    const token = getCookie(request, 'auth_token');
    if (token === null) {
      return response({
        code: 'AUTH_REQUIRED',
        error: 'Canlı araç konumlarını görmek için giriş yapmalısınız.',
      }, 401);
    }

    const session = await dependencies.verifySession(token);
    if (session === 'invalid') {
      return response({
        code: 'AUTH_REQUIRED',
        error: 'Oturumunuz sona erdi. Canlı araç konumları için yeniden giriş yapın.',
      }, 401);
    }
    if (session === 'unavailable') {
      return response({
        code: 'AUTH_UNAVAILABLE',
        error: 'Oturum doğrulama servisi geçici olarak kullanılamıyor.',
      }, 503);
    }

    try {
      return response(await dependencies.getLocations(lineCode));
    } catch (error) {
      console.error('IETT konum API error:', error);
      return response({ error: 'Araç konum bilgileri alınamadı' }, 500);
    }
  };
}

export function clearLiveIettSessionCacheForTests(): void {
  sessionCache.clear();
}
