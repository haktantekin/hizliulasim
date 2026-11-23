import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureEnvelope } from '../../../lib/toilets/test-fixtures.ts';
import { createToiletsHandler } from './handler.ts';
import { decodeToiletEnvelope } from '../../../lib/toilets/wire.ts';
import { getToilets } from '../../../lib/toilets/source.ts';

test('serves CMS data with a short shared cache and no browser freshness window', async () => {
  const response = await createToiletsHandler(async () => fixtureEnvelope())();
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=0, s-maxage=300, stale-while-revalidate=60, must-revalidate',
  );
  const body = await response.json();
  assert.equal(body.encoding, 'compact-v1');
  assert.deepEqual(decodeToiletEnvelope(body), fixtureEnvelope());
});

test('unavailable data returns retryable 503 without leaking provider/internal errors', async () => {
  const response = await createToiletsHandler(async () => { throw new Error('private connection details'); })();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '600');
  assert.doesNotMatch(await response.text(), /private connection/u);
});

test('a CMS outage reaches the retryable 503 path instead of serving frontend data', async () => {
  const response = await createToiletsHandler(() => getToilets({
    fetcher: async () => { throw new Error('CMS connection failed'); },
  }))();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '600');
  assert.deepEqual(await response.json(), { error: 'Tuvalet bilgileri şu anda alınamıyor.' });
});
