export type CmsRedirectRule = {
  source: string;
  destination: string;
};

export type BuildRedirectRule = {
  source: string;
  destination: string;
  statusCode: 301;
};

type RedirectFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

type LoadRedirectManifestOptions = {
  endpoint?: string;
  fetchImpl?: RedirectFetch;
  attempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

const CMS_REDIRECTS_ENDPOINT = 'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/redirects';
const SITE_ORIGIN = 'https://hizliulasim.com';

function isCmsRedirectRule(value: unknown): value is CmsRedirectRule {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CmsRedirectRule>;
  return typeof candidate.source === 'string' && typeof candidate.destination === 'string';
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

function normalizeSource(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;

  try {
    const url = new URL(trimmed, SITE_ORIGIN);
    if (url.origin !== SITE_ORIGIN || url.search || url.hash) return null;
    return normalizePath(url.pathname);
  } catch {
    return null;
  }
}

function normalizeDestination(destination: string): string | null {
  try {
    const url = new URL(destination.trim(), SITE_ORIGIN);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())) {
      return `${normalizePath(url.pathname)}${url.search}${url.hash}`;
    }

    const destinationHost = url.hostname.replace(/^www\./i, '').toLowerCase();
    const siteHost = new URL(SITE_ORIGIN).hostname.toLowerCase();
    if (destinationHost === siteHost) {
      return `${normalizePath(url.pathname)}${url.search}${url.hash}`;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function buildRedirectManifest(payload: unknown): BuildRedirectRule[] {
  if (!Array.isArray(payload)) return [];

  const seenSources = new Set<string>();
  const redirects: BuildRedirectRule[] = [];

  for (const item of payload) {
    if (!isCmsRedirectRule(item)) continue;

    const source = normalizeSource(item.source);
    const destination = normalizeDestination(item.destination);
    if (!source || !destination || source === destination || seenSources.has(source)) continue;

    seenSources.add(source);
    redirects.push({ source, destination, statusCode: 301 });
  }

  return redirects;
}

export async function loadRedirectManifest({
  endpoint = CMS_REDIRECTS_ENDPOINT,
  fetchImpl = fetch,
  attempts = 3,
  retryDelayMs = 250,
  timeoutMs = 20_000,
}: LoadRedirectManifestOptions = {}): Promise<BuildRedirectRule[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`CMS redirects request failed: ${response.status}`);
      }

      const rawPayload = (await response.text()).replace(/^\uFEFF/, '');
      const payload: unknown = JSON.parse(rawPayload);
      if (!Array.isArray(payload)) {
        throw new Error('CMS redirects response is not an array');
      }

      return buildRedirectManifest(payload);
    } catch (error) {
      lastError = error;
      if (attempt < attempts && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('CMS redirects request failed');
}

export async function loadRedirectManifestWithFallback({
  fallbackPayload,
  minimumRules,
  ...options
}: LoadRedirectManifestOptions & {
  fallbackPayload: unknown;
  minimumRules: number;
}): Promise<{
  manifest: BuildRedirectRule[];
  usedFallback: boolean;
  refreshError?: unknown;
}> {
  try {
    const manifest = await loadRedirectManifest(options);
    if (manifest.length < minimumRules) {
      throw new Error(`CMS redirect manifest is unexpectedly small (${manifest.length} rules)`);
    }
    return { manifest, usedFallback: false };
  } catch (refreshError) {
    const manifest = buildRedirectManifest(fallbackPayload);
    if (manifest.length < minimumRules) {
      throw new Error(
        `Redirect fallback manifest is unexpectedly small (${manifest.length} rules)`,
        { cause: refreshError },
      );
    }
    return { manifest, usedFallback: true, refreshError };
  }
}
