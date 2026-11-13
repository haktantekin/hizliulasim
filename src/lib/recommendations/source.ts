import { parseRecommendationSource, type RecommendationSource } from './contracts.ts';
import { createRecommendationSourceCache } from './source-cache.ts';

const DEFAULT_WORDPRESS_API = 'https://cms.hizliulasim.com/wp-json';
const RECOMMENDATION_SOURCE_VERSION = '20261113-2';
const RECOMMENDATION_SOURCE_BUCKET_MS = 5 * 60 * 1_000;
const sourceCache = createRecommendationSourceCache();

function wordpressApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_WP_API_URL?.trim();
  return (configured?.replace(/\/wp\/v2\/?$/u, '') || DEFAULT_WORDPRESS_API).replace(/\/$/u, '');
}

function hasRecommendationSourceShape(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Array.isArray((value as Record<string, unknown>).candidates)
    && Array.isArray((value as Record<string, unknown>).overrides);
}

function recommendationSourceVersion(): string {
  return `${RECOMMENDATION_SOURCE_VERSION}-${Math.floor(Date.now() / RECOMMENDATION_SOURCE_BUCKET_MS)}`;
}

export async function fetchRecommendationSource(fetchImpl: typeof fetch = fetch): Promise<RecommendationSource | null> {
  const cached = sourceCache.read();
  if (cached?.state === 'current' && cached.source.candidates.length > 0) return cached.source;

  try {
    const response = await fetchImpl(`${wordpressApiBase()}/hizliulasim/v1/daily-recommendations?v=${recommendationSourceVersion()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Recommendation source unavailable');
    const payload: unknown = await response.json();
    if (!hasRecommendationSourceShape(payload)) throw new Error('Invalid recommendation source');
    const source = parseRecommendationSource(payload);
    if (source.candidates.length === 0) return cached?.source ?? source;
    sourceCache.write(source);
    return source;
  } catch {
    return cached?.source ?? null;
  }
}
