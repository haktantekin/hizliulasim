import { createHash } from 'node:crypto';
import { normalizeIettStaticCode } from '../lib/iett-static/contracts.ts';
import type { IETTHatOtoKonum } from '../types/iett.ts';

export type LiveSessionStatus = 'valid' | 'invalid' | 'unavailable';

interface LiveVehicleDependencies {
  verifySession(token: string): Promise<LiveSessionStatus>;
  getLocations(lineCode: string): Promise<IETTHatOtoKonum[]>;
  now?: () => number;
  liveCacheTtlMs?: number;
  liveStaleTtlMs?: number;
  hourlyProviderRequestLimit?: number;
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
const defaultLiveCacheTtlMs = 60_000;
const defaultLiveStaleTtlMs = 5 * 60_000;
const defaultHourlyProviderRequestLimit = 90;
const providerWindowMs = 60 * 60_000;

interface CachedLiveVehicles {
  data: IETTHatOtoKonum[];
  fetchedAt: number;
  expiresAt: number;
  staleUntil: number;
}

type LiveCacheStatus = 'HIT' | 'MISS' | 'STALE';

class LiveProviderRateLimitError extends Error {}

function response(
  body: object | IETTHatOtoKonum[],
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      ...extraHeaders,
    },
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
  const now = dependencies.now ?? Date.now;
  const liveCacheTtlMs = dependencies.liveCacheTtlMs ?? defaultLiveCacheTtlMs;
  const liveStaleTtlMs = dependencies.liveStaleTtlMs ?? defaultLiveStaleTtlMs;
  const hourlyProviderRequestLimit = dependencies.hourlyProviderRequestLimit ?? defaultHourlyProviderRequestLimit;
  const locationCache = new Map<string, CachedLiveVehicles>();
  const pendingLocations = new Map<string, Promise<CachedLiveVehicles>>();
  let providerCallTimes: number[] = [];

  async function loadLocations(lineCode: string): Promise<{ entry: CachedLiveVehicles; cacheStatus: LiveCacheStatus }> {
    const currentTime = now();
    const cached = locationCache.get(lineCode);
    if (cached && cached.expiresAt > currentTime) {
      return { entry: cached, cacheStatus: 'HIT' };
    }

    const pending = pendingLocations.get(lineCode);
    if (pending) {
      return { entry: await pending, cacheStatus: 'HIT' };
    }

    providerCallTimes = providerCallTimes.filter((timestamp) => timestamp > currentTime - providerWindowMs);
    if (providerCallTimes.length >= hourlyProviderRequestLimit) {
      if (cached && cached.staleUntil > currentTime) {
        return { entry: cached, cacheStatus: 'STALE' };
      }
      throw new LiveProviderRateLimitError('IETT live provider request budget exhausted');
    }

    providerCallTimes.push(currentTime);
    const request = dependencies.getLocations(lineCode).then((data) => {
      const fetchedAt = now();
      const entry: CachedLiveVehicles = {
        data,
        fetchedAt,
        expiresAt: fetchedAt + liveCacheTtlMs,
        staleUntil: fetchedAt + liveStaleTtlMs,
      };
      if (locationCache.size >= 512 && !locationCache.has(lineCode)) {
        locationCache.delete(locationCache.keys().next().value as string);
      }
      locationCache.set(lineCode, entry);
      return entry;
    });
    pendingLocations.set(lineCode, request);

    try {
      return { entry: await request, cacheStatus: 'MISS' };
    } catch (error) {
      if (cached && cached.staleUntil > now()) {
        return { entry: cached, cacheStatus: 'STALE' };
      }
      throw error;
    } finally {
      pendingLocations.delete(lineCode);
    }
  }

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
      const { entry, cacheStatus } = await loadLocations(lineCode);
      return response(entry.data, 200, {
        'X-IETT-Live-Cache': cacheStatus,
        'X-IETT-Live-Updated-At': new Date(entry.fetchedAt).toISOString(),
        'X-IETT-Live-Refresh-Seconds': String(Math.round(liveCacheTtlMs / 1000)),
        ...(cacheStatus === 'STALE' ? { Warning: '110 - "Response is stale"' } : {}),
      });
    } catch (error) {
      if (error instanceof LiveProviderRateLimitError) {
        return response({
          code: 'LIVE_RATE_LIMITED',
          error: 'Canlı araç hizmeti istek sınırı nedeniyle geçici olarak kullanılamıyor.',
        }, 503, { 'Retry-After': '60' });
      }
      console.error('IETT konum API error:', error);
      return response({ error: 'Araç konum bilgileri alınamadı' }, 500);
    }
  };
}

export function clearLiveIettSessionCacheForTests(): void {
  sessionCache.clear();
}
