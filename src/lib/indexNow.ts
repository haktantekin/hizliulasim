const SITE_URL = 'https://hizliulasim.com';
const INDEX_NOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const CMS_TOKEN_VERIFY_URL =
  'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/sitemap-feed/verify';
const BATCH_SIZE = 10_000;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRY_DELAY_MS = 10_000;

export type IndexNowBatchResult = {
  batch: number;
  count: number;
  status: number;
  ok: boolean;
  attempts: number;
};

type AuthorizationOptions = {
  configuredSecret: string;
  providedSecret: string;
  cmsToken: string;
  fetch?: typeof fetch;
};

export async function authorizeIndexNowRequest(
  options: AuthorizationOptions,
): Promise<'secret' | 'cms' | null> {
  if (
    options.configuredSecret !== '' &&
    options.providedSecret === options.configuredSecret
  ) {
    return 'secret';
  }

  if (options.cmsToken === '') {
    return null;
  }

  const fetchImpl = options.fetch ?? fetch;
  const verification = await fetchImpl(CMS_TOKEN_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: options.cmsToken }),
    cache: 'no-store',
  }).catch(() => null);

  return verification?.ok ? 'cms' : null;
}

export function normalizeIndexNowUrls(urls: unknown[]): string[] {
  const normalized = new Set<string>();

  for (const value of urls) {
    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }

    try {
      const url = new URL(value.trim(), `${SITE_URL}/`);
      if (url.protocol !== 'https:' || url.hostname !== 'hizliulasim.com' || url.port) {
        continue;
      }

      url.search = '';
      url.hash = '';
      url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
      normalized.add(url.toString().replace(/\/$/, url.pathname === '/' ? '/' : ''));
    } catch {
      // Invalid and off-site values are ignored at the public boundary.
    }
  }

  return [...normalized];
}

export function canSubmitProductionUrls(
  nodeEnv: string | undefined,
  allowNonProduction: string | undefined,
): boolean {
  return nodeEnv === 'production' || allowNonProduction === 'true';
}

type SubmitOptions = {
  key: string;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  endpoint?: string;
  timeoutMs?: number;
};

function retryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    }

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay) && dateDelay > 0) {
      return Math.min(dateDelay, MAX_RETRY_DELAY_MS);
    }
  }

  return Math.min(500 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
}

function isRetryable(response: Response | null): boolean {
  return response === null || response.status === 429 || response.status >= 500;
}

export async function submitIndexNow(urls: string[], options: SubmitOptions) {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const endpoint = options.endpoint ?? INDEX_NOW_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const results: IndexNowBatchResult[] = [];

  for (let offset = 0; offset < urls.length; offset += BATCH_SIZE) {
    const batch = urls.slice(offset, offset + BATCH_SIZE);
    let response: Response | null = null;
    let attempts = 0;

    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: 'hizliulasim.com',
            key: options.key,
            keyLocation: `${SITE_URL}/indexnow-key.txt`,
            urlList: batch,
          }),
          signal: controller.signal,
        });
      } catch {
        response = null;
      } finally {
        clearTimeout(timeout);
      }

      if (response?.ok || !isRetryable(response) || attempts === MAX_ATTEMPTS) {
        break;
      }

      await sleep(retryDelay(response, attempts));
    }

    results.push({
      batch: Math.floor(offset / BATCH_SIZE) + 1,
      count: batch.length,
      status: response?.status ?? 0,
      ok: Boolean(response?.ok),
      attempts,
    });
  }

  return {
    success: results.length > 0 && results.every((result) => result.ok),
    totalUrls: urls.length,
    results,
  };
}
