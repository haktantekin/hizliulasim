import type { RecommendationSource } from './contracts.ts';

export interface RecommendationSourceCacheHit {
  source: RecommendationSource;
  state: 'current' | 'stale';
  savedAt: number;
}

export interface RecommendationSourceCache {
  read(): RecommendationSourceCacheHit | null;
  write(value: unknown): boolean;
  clear(): void;
}

function isValidSource(value: unknown): value is RecommendationSource {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Partial<RecommendationSource>;
  return (source.generatedAt === null
      || (typeof source.generatedAt === 'string' && Number.isFinite(Date.parse(source.generatedAt))))
    && Array.isArray(source.candidates)
    && source.candidates.length <= 240
    && Array.isArray(source.overrides)
    && source.overrides.length <= 20;
}

export function createRecommendationSourceCache(options: {
  now?: () => number;
  freshMs?: number;
  maxStaleMs?: number;
} = {}): RecommendationSourceCache {
  const now = options.now ?? Date.now;
  const freshMs = options.freshMs ?? 5 * 60 * 1_000;
  const maxStaleMs = options.maxStaleMs ?? 6 * 60 * 60 * 1_000;
  let entry: { source: RecommendationSource; savedAt: number } | null = null;

  return {
    read() {
      if (!entry || !isValidSource(entry.source)) {
        entry = null;
        return null;
      }
      const age = now() - entry.savedAt;
      if (!Number.isFinite(age) || age < 0 || age > maxStaleMs) {
        entry = null;
        return null;
      }
      return {
        ...entry,
        state: age <= freshMs ? 'current' : 'stale',
      };
    },
    write(value) {
      if (!isValidSource(value)) return false;
      entry = { source: value, savedAt: now() };
      return true;
    },
    clear() {
      entry = null;
    },
  };
}
