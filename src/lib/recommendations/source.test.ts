import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchRecommendationSource } from './source.ts';

test('retries an empty CMS snapshot, then keeps the populated snapshot locally', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  let requestCount = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestCount += 1;
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json(requestCount === 1
      ? {
          generatedAt: '2026-11-13T22:00:00+03:00',
          candidates: [],
          overrides: [],
        }
      : {
          generatedAt: '2026-11-13T22:05:00+03:00',
          candidates: [{
            id: 25239,
            title: 'Capitol AVM Yol Tarifi',
            excerpt: '',
            href: '/ulasim-rehberi/avmler/capitol-avm',
            image: null,
            category: { slug: 'avmler', name: 'AVMler', parentSlug: 'ulasim-rehberi' },
            profile: {
              enabled: true,
              venueMode: 'indoor',
              weatherFit: ['rain', 'hot', 'cold'],
              budget: 'unknown',
              audiences: ['general', 'family'],
              durationBand: 'half_day',
              seasonMonths: [],
              calendarTags: [],
              district: '',
              editorialWeight: 0,
            },
            location: { latitude: 41.02111, longitude: 29.03944 },
          }],
          overrides: [],
        });
  };

  const first = await fetchRecommendationSource(fetchImpl);
  const second = await fetchRecommendationSource(fetchImpl);
  const third = await fetchRecommendationSource(fetchImpl);

  assert.match(requestedUrl, /\/hizliulasim\/v1\/daily-recommendations\?v=20261113-2-[0-9]+$/u);
  assert.equal(requestedInit?.cache, 'no-store');
  assert.equal(requestCount, 2);
  assert.deepEqual(first?.candidates, []);
  assert.equal(second?.candidates[0]?.id, 25239);
  assert.equal(third, second);
});
