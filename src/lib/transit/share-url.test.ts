import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTransitPlannerUrl, parseTransitPlannerUrl, type ShareablePlannerState } from './share-url.ts';

const state: ShareablePlannerState = {
  origin: { name: 'Şişli & Çağlayan', latitude: 41.06078543, longitude: 28.98765432 },
  destination: { name: 'Kadıköy İskelesi + Rıhtım', latitude: 40.99068888, longitude: 29.02123333 },
  departureAt: '2026-11-10T07:00:00.000Z',
  preference: 'fewer-transfers',
  selectedAlternative: 2,
};

test('shares both endpoints with Turkish labels, bounded precision and the selected options', () => {
  const url = buildTransitPlannerUrl(state);
  const { pathname, searchParams } = new URL(url, 'https://hizliulasim.com');
  assert.equal(pathname, '/yol-tarifi');
  assert.match(url, /^\/yol-tarifi\?/u);
  assert.match(url, /%C5%9Ei%C5%9Fli\+%26\+%C3%87a%C4%9Flayan/u);
  assert.deepEqual(Object.fromEntries(searchParams), {
    o: '41.06079,28.98765', on: 'Şişli & Çağlayan',
    d: '40.99069,29.02123', dn: 'Kadıköy İskelesi + Rıhtım',
    t: '2026-11-10T07:00:00.000Z', p: 'fewer-transfers', a: '2',
  });
  assert.deepEqual(parseTransitPlannerUrl(searchParams), {
    origin: { name: 'Şişli & Çağlayan', latitude: 41.06079, longitude: 28.98765 },
    destination: { name: 'Kadıköy İskelesi + Rıhtım', latitude: 40.99069, longitude: 29.02123 },
    departureAt: '2026-11-10T07:00:00.000Z', preference: 'fewer-transfers', selectedAlternative: 2,
  });
});

test('serializes only the known share fields and bounds display labels', () => {
  const url = buildTransitPlannerUrl({
    ...state,
    origin: { ...state.origin, name: `  ${'İ🚉'.repeat(100)}  ` },
    destination: { ...state.destination, name: '   ' },
    selectedAlternative: 3,
    ...{ placeId: 'opaque-upstream-id', apiKey: 'hidden' },
  });
  const params = new URL(url, 'https://hizliulasim.com').searchParams;
  assert.deepEqual([...params.keys()].sort(), ['d', 'o', 'on', 'p', 't']);
  assert.equal(params.get('on'), 'İ🚉'.repeat(60));
  assert.equal(parseTransitPlannerUrl(params).destination?.name, 'Hedef');
});

test('ignores missing, duplicate or invalid parameters independently', () => {
  const params = new URLSearchParams([
    ['o', '41,29'], ['o', '41.1,29.1'], ['on', 'Başka başlangıç'],
    ['d', '41.01,29.02'], ['dn', 'A'], ['dn', 'B'],
    ['t', state.departureAt], ['t', state.departureAt],
    ['p', 'fastest'], ['p', 'fastest'], ['a', '1'], ['a', '1'],
    ['key', 'opaque'],
  ]);
  assert.deepEqual(parseTransitPlannerUrl(params), {
    destination: { name: 'Hedef', latitude: 41.01, longitude: 29.02 },
  });
  assert.deepEqual(parseTransitPlannerUrl(new URLSearchParams()), {});
});

for (const coordinate of ['41', '41,29,30', ' 41,29', '41,', 'NaN,29', '4.1e1,29', '41.000001,29', '90.1,29', '41,32']) {
  test(`rejects a malformed or out-of-area coordinate pair ${JSON.stringify(coordinate)}`, () => {
    assert.deepEqual(parseTransitPlannerUrl(new URLSearchParams({ o: coordinate })), {});
  });
}

for (const departure of ['tomorrow', '2026-11-10', '2026-11-10T07:00:00', '2026-11-31T07:00:00Z', '2099-11-10T07:00:00.000Z']) {
  test(`rejects an invalid or unsupported departure ${departure}`, () => {
    assert.deepEqual(parseTransitPlannerUrl(new URLSearchParams({ t: departure })), {});
  });
}

test('ignores unsupported preferences and malformed or out-of-range alternative indices', () => {
  for (const a of ['-1', '3', '1.0', '01', ' 1', '1e0', '9007199254740992']) {
    assert.deepEqual(parseTransitPlannerUrl(new URLSearchParams({ p: 'quickest', a })), {});
  }
  assert.deepEqual(parseTransitPlannerUrl(new URLSearchParams({ p: 'less-walking', a: '0' })), {
    preference: 'less-walking', selectedAlternative: 0,
  });
});

test('falls back to the endpoint label when a query label is overlong or contains a control character', () => {
  const params = new URLSearchParams({ o: '41,29', on: 'ş'.repeat(121), d: '41.01,29.02', dn: 'A\u0000B' });
  assert.deepEqual(parseTransitPlannerUrl(params), {
    origin: { name: 'Başlangıç', latitude: 41, longitude: 29 },
    destination: { name: 'Hedef', latitude: 41.01, longitude: 29.02 },
  });
});
