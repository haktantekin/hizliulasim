import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureEnvelope } from './test-fixtures.ts';
import { getToilets } from './source.ts';

const now = () => new Date('2026-11-23T10:00:00Z');

test('visitor reads only stored CMS records; no source API or coordinate query is sent', async () => {
  const calls: string[] = [];
  const value = await getToilets({ now, fetcher: async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.method ?? 'GET', 'GET');
    assert.equal(init?.cache, 'no-store');
    return Response.json(fixtureEnvelope());
  } });
  assert.deepEqual(calls, ['https://cms.hizliulasim.com/wp-json/hizliulasim/v1/toilets']);
  assert.deepEqual(value.metadata, { storage: 'database', stale: false });
});

test('a failed CMS, invalid/partial data or an oversized reply fails without a local fallback', async () => {
  for (const fetcher of [
    async () => { throw new Error('offline'); },
    async () => new Response('unavailable', { status: 503 }),
    async () => Response.json({ ...fixtureEnvelope(), toilets: [] }),
    async () => new Response('x', { headers: { 'Content-Length': String(17 * 1024 * 1024) } }),
  ]) {
    await assert.rejects(() => getToilets({ now, fetcher }));
  }
});

test('a valid partial CMS dataset remains partial without adding bundled records', async () => {
  const database = fixtureEnvelope();
  database.toilets = database.toilets.filter((point) => point.source === 'ibb');
  database.toilets[0].name = 'Updated CMS name';
  database.sources.osm = { count: 0, updatedAt: null, status: 'unavailable' };
  const value = await getToilets({ now, fetcher: async () => Response.json(database) });
  assert.equal(value.toilets.length, 1);
  assert.equal(value.toilets[0].name, 'Updated CMS name');
  assert.equal(value.sources.ibb.status, 'current');
  assert.deepEqual(value.sources.osm, { count: 0, updatedAt: null, status: 'unavailable' });
  assert.deepEqual(value.metadata, { storage: 'database', stale: true });
});

test('old database records remain usable but are not described as current', async () => {
  const value = await getToilets({
    now: () => new Date('2026-12-15T10:00:00Z'), fetcher: async () => Response.json(fixtureEnvelope()) });
  assert.equal(value.toilets.length, 2);
  assert.equal(value.metadata?.storage, 'database');
  assert.equal(value.metadata?.stale, true);
  assert.equal(value.sources.osm.status, 'stale');
});

test('keeps a source marked stale by the CMS even when its timestamp is recent', async () => {
  const database = fixtureEnvelope();
  database.sources.osm.status = 'stale';
  const value = await getToilets({ now, fetcher: async () => Response.json(database) });
  assert.equal(value.sources.ibb.status, 'current');
  assert.equal(value.sources.osm.status, 'stale');
  assert.deepEqual(value.metadata, { storage: 'database', stale: true });
});

test('rejects unsafe CMS endpoint overrides before making a request', async () => {
  let calls = 0;
  for (const endpoint of ['http://cms.example.test/toilets', 'https://user:password@cms.example.test/toilets', 'https://cms.example.test/toilets#fragment']) {
    await assert.rejects(() => getToilets({ endpoint, fetcher: async () => {
      calls++;
      return Response.json(fixtureEnvelope());
    } }));
  }
  assert.equal(calls, 0);
});
