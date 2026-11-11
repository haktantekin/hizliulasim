import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestTransitRoutes, TransitRouteError } from './client.ts';
import type { TransitItinerary, TransitRouteRequest } from './contracts.ts';
import { buildTransitPlannerUrl, parseTransitPlannerUrl } from './share-url.ts';

const input: TransitRouteRequest = {
  origin: [41.001234, 28.999876],
  destination: [41.021234, 29.021234],
  departureAt: new Date('2026-11-10T07:00:00Z'),
  preference: 'less-walking',
};
const board = { role: 'board', name: 'Çarşı', coordinate: [41, 29] } as const;
const itinerary: TransitItinerary = {
  durationMinutes: 10,
  walkingMinutes: 0,
  transferCount: 0,
  departureTime: '10:00',
  arrivalTime: '10:10',
  steps: [{
    kind: 'ride', mode: 'bus', lineCode: '25G', color: '#f59e0b', stopCount: 4,
    durationMinutes: 10, distanceMeters: 2300, departureTime: '10:00', arrivalTime: '10:10',
    geometry: [[41, 29], [41.02, 29.02]], geometryQuality: 'approximate',
    board: { ...board, coordinate: [41, 29] },
    alight: { role: 'alight', name: 'İskele', coordinate: [41.02, 29.02] },
  }],
  keyPoints: [
    { role: 'origin', name: 'Başlangıç', coordinate: input.origin },
    { ...board, coordinate: [41, 29] },
    { role: 'alight', name: 'İskele', coordinate: [41.02, 29.02] },
    { role: 'destination', name: 'Hedef', coordinate: input.destination },
  ],
  metadata: {
    dataVersion: 'fixture_v1', generatedAt: '2026-11-10T06:59:00Z', serviceDate: '2026-11-10',
    approximateWalking: false, geometryQuality: 'approximate',
  },
};
const payload = {
  itineraries: [itinerary],
  metadata: { dataVersion: 'fixture_v1', usedFallback: false },
  diagnostics: { connectionBuckets: 1, connectionShards: 1, originCandidates: 2, destinationCandidates: 3 },
};

test('requests the local route API with the six contract parameters and returns its itineraries', async (t) => {
  const fetchRoute = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const signal = new AbortController().signal;

  assert.deepEqual(await requestTransitRoutes(input, signal), payload);
  assert.equal(fetchRoute.mock.callCount(), 1);
  const [url, init] = fetchRoute.mock.calls[0].arguments as Parameters<typeof fetch>;
  const { pathname, searchParams } = new URL(String(url), 'https://hizliulasim.com');
  assert.equal(pathname, '/api/transit/route');
  assert.match(String(url), /^\/api\/transit\/route\?/u);
  assert.deepEqual(Object.fromEntries(searchParams), {
    originLat: '41.00123', originLng: '28.99988',
    destinationLat: '41.02123', destinationLng: '29.02123',
    departureAt: '2026-11-10T07:00:00.000Z', preference: 'less-walking',
  });
  assert.equal(init?.method ?? 'GET', 'GET');
  assert.equal(init?.signal, signal);
});

test('requests the same coordinates before and after sharing a route near a boarding threshold', async (t) => {
  const fetchRoute = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  // Rounding this origin changes walking time to the nearby stop at [41.00001, 29].
  const origin = { name: 'Başlangıç', latitude: 41.0000049, longitude: 29 };
  const destination = { name: 'Hedef', latitude: 42.4999951, longitude: 30.9999949 };
  const departureAt = input.departureAt.toISOString();
  const preference = input.preference;
  const sharedUrl = new URL(buildTransitPlannerUrl({ origin, destination, departureAt, preference }), 'https://hizliulasim.com');
  assert.equal(sharedUrl.searchParams.get('o'), '41,29');
  assert.equal(sharedUrl.searchParams.get('d'), '42.5,30.99999');
  const restored = parseTransitPlannerUrl(sharedUrl.searchParams);
  assert.ok(restored.origin && restored.destination && restored.departureAt && restored.preference);

  await requestTransitRoutes({
    origin: [origin.latitude, origin.longitude], destination: [destination.latitude, destination.longitude],
    departureAt: input.departureAt, preference,
  });
  await requestTransitRoutes({
    origin: [restored.origin.latitude, restored.origin.longitude],
    destination: [restored.destination.latitude, restored.destination.longitude],
    departureAt: new Date(restored.departureAt), preference: restored.preference,
  });

  const requestedUrls = fetchRoute.mock.calls.map(({ arguments: [url] }) => String(url));
  assert.equal(requestedUrls.length, 2);
  assert.equal(requestedUrls[0], requestedUrls[1]);
});

test('rejects an out-of-area coordinate before rounding could bring it into range', async (t) => {
  const fetchRoute = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 }));

  await assert.rejects(requestTransitRoutes({ ...input, origin: [39.499999, 29] }), {
    name: 'TransitRouteError', code: 'INVALID_REQUEST',
  });
  assert.equal(fetchRoute.mock.callCount(), 0);
});

for (const [status, code, safeCopy] of [
  [400, 'INVALID_REQUEST', /geçersiz/u],
  [404, 'NO_ROUTE', /rota.*bulunamadı/u],
  [503, 'DATA_UNAVAILABLE', /verileri.*kullanılamıyor/u],
  [504, 'ROUTE_TIMEOUT', /zaman.*sınır/u],
] as const) {
  test(`maps ${code} to safe Turkish copy`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ error: { code, message: 'private upstream response' } }, { status }));

    await assert.rejects(requestTransitRoutes(input), (error: unknown) => {
      assert.ok(error instanceof TransitRouteError);
      assert.equal(error.code, code);
      assert.match(error.message, safeCopy);
      assert.doesNotMatch(error.message, /private upstream/u);
      return true;
    });
  });
}

test('preserves the abort reason when an in-flight request is cancelled', async (t) => {
  const controller = new AbortController();
  const reason = new DOMException('Yolculuk değişti.', 'AbortError');
  t.mock.method(globalThis, 'fetch', async (_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
  });

  const result = requestTransitRoutes(input, controller.signal);
  controller.abort(reason);
  await assert.rejects(result, (error: unknown) => error === reason);
});

test('does not fetch with an already aborted signal', async (t) => {
  const controller = new AbortController();
  controller.abort();
  const fetchRoute = t.mock.method(globalThis, 'fetch', async () => Response.json(payload));

  await assert.rejects(requestTransitRoutes(input, controller.signal), { name: 'AbortError' });
  assert.equal(fetchRoute.mock.callCount(), 0);
});

for (const [description, makeResponse] of [
  ['an unknown error code', () => Response.json({ error: { code: 'toString' } }, { status: 500 })],
  ['non-JSON', () => new Response('<html>private upstream response</html>')],
  ['a missing itinerary envelope', () => Response.json({ routes: [] })],
  ['an empty itinerary envelope', () => Response.json({ ...payload, itineraries: [] })],
  ['a malformed itinerary', () => Response.json({ ...payload, itineraries: [{ ...itinerary, steps: [null] }] })],
  ['a network failure', () => { throw new Error('private upstream response'); }],
] as const) {
  test(`uses a safe data-unavailable error for ${description}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => makeResponse());

    await assert.rejects(requestTransitRoutes(input), {
      name: 'TransitRouteError', code: 'DATA_UNAVAILABLE', message: /verileri.*kullanılamıyor/u,
    });
  });
}
