import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestTransitRoutes, TransitRouteError } from './client.ts';
import type { TransitItinerary, TransitRouteRequest } from './contracts.ts';

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
    originLat: '41.001234', originLng: '28.999876',
    destinationLat: '41.021234', destinationLng: '29.021234',
    departureAt: '2026-11-10T07:00:00.000Z', preference: 'less-walking',
  });
  assert.equal(init?.method ?? 'GET', 'GET');
  assert.equal(init?.signal, signal);
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
