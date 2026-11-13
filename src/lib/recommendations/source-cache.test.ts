import assert from 'node:assert/strict';
import test from 'node:test';

import type { RecommendationSource } from './contracts.ts';
import { createRecommendationSourceCache } from './source-cache.ts';

const source: RecommendationSource = {
  generatedAt: '2026-11-13T10:00:00.000Z',
  candidates: [],
  overrides: [],
};

test('son geçerli kaynağı tazeyken ve izin verilen eskime aralığındayken döndürür', () => {
  let now = 1_000;
  const cache = createRecommendationSourceCache({ now: () => now, freshMs: 300, maxStaleMs: 1_000 });
  cache.write(source);

  assert.deepEqual(cache.read(), { source, state: 'current', savedAt: 1_000 });
  now = 1_500;
  assert.deepEqual(cache.read(), { source, state: 'stale', savedAt: 1_000 });
});

test('azami eskime süresini aşan kaydı siler', () => {
  let now = 1_000;
  const cache = createRecommendationSourceCache({ now: () => now, freshMs: 300, maxStaleMs: 1_000 });
  cache.write(source);
  now = 2_001;

  assert.equal(cache.read(), null);
  assert.equal(cache.read(), null);
});

test('geçersiz veya sınırsız kaynak önbelleğe yazılmaz', () => {
  const cache = createRecommendationSourceCache();
  assert.equal(cache.write(null), false);
  assert.equal(cache.write({ generatedAt: null, candidates: new Array(241).fill({}), overrides: [] }), false);
  assert.equal(cache.write({ generatedAt: 'invalid', candidates: [], overrides: [] }), false);
  assert.equal(cache.read(), null);
});
