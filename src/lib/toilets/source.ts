import { parseToiletEnvelope, type ToiletEnvelope } from './contracts.ts';

const defaultEndpoint = 'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/toilets';
const maximumBodyBytes = 16 * 1024 * 1024;
const maximumAgeMs = 8 * 24 * 60 * 60 * 1000;

interface ToiletDependencies {
  endpoint?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}

function endpoint(configured?: string): string {
  const url = new URL(configured?.trim() || process.env.TOILETS_CMS_URL?.trim() || defaultEndpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Invalid toilet CMS endpoint');
  return url.href;
}

async function readDataset(response: Response): Promise<ToiletEnvelope> {
  if (!response.ok || !response.body) throw new Error('Toilet database unavailable');
  if (Number(response.headers.get('content-length')) > maximumBodyBytes) throw new Error('Toilet dataset too large');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBodyBytes) throw new Error('Toilet dataset too large');
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return parseToiletEnvelope(JSON.parse(body));
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Read the stored CMS records only. Visitor requests never trigger an İBB/Overpass import. */
export async function getToilets(dependencies: ToiletDependencies = {}): Promise<ToiletEnvelope> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 8_000);
  try {
    const database = await readDataset(await (dependencies.fetcher ?? fetch)(endpoint(dependencies.endpoint), {
      headers: { Accept: 'application/json' },
      // The expanded venue catalog can exceed Next's per-entry Data Cache limit.
      // /api/toilets caches its public response for 10 minutes at the CDN instead.
      cache: 'no-store',
      signal: abort.signal,
    }));
    const now = (dependencies.now?.() ?? new Date()).getTime();
    const result: ToiletEnvelope = {
      ...database,
      sources: { ...database.sources },
      metadata: { storage: 'database', stale: false },
    };
    for (const source of ['ibb', 'osm'] as const) {
      const state = database.sources[source];
      const tooOld = !state.updatedAt || now - Date.parse(state.updatedAt) > maximumAgeMs;
      const stale = state.status !== 'current' || tooOld;
      result.sources[source] = {
        ...state,
        status: state.status === 'unavailable' ? 'unavailable' : stale ? 'stale' : 'current',
      };
      if (stale) result.metadata!.stale = true;
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
