import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransitBoardingPoint, TransitItinerary, TransitLeg } from './contracts.ts';
import { buildTransitMapModel } from './map-model.ts';

const canonicalUrl = 'https://hizliulasim.com/otobus-duraklari/carsi-123456';
const origin = { role: 'origin', name: 'Başlangıç', coordinate: [41, 29] } satisfies TransitBoardingPoint;
const board = {
  role: 'board', name: 'Çarşı', coordinate: [41.01, 29.01], stopId: '1', code: '123456',
  contentLink: { title: 'Çarşı Durağı', canonicalUrl },
} satisfies TransitBoardingPoint;
const alight = { role: 'alight', name: 'İskele', coordinate: [41.02, 29.02], stopId: '2' } satisfies TransitBoardingPoint;
const lastStop = { role: 'alight', name: 'Meydan', coordinate: [41.03, 29.03], stopId: '3' } satisfies TransitBoardingPoint;
const destination = { role: 'destination', name: 'Hedef', coordinate: [41.04, 29.04] } satisfies TransitBoardingPoint;

const walk: Extract<TransitLeg, { kind: 'walk' }> = {
  kind: 'walk', mode: 'walking', departureTime: '10:00', arrivalTime: '10:05', durationMinutes: 5,
  distanceMeters: 400, geometryQuality: 'approximate', geometry: [origin.coordinate, board.coordinate],
};
const bus: Extract<TransitLeg, { kind: 'ride' }> = {
  kind: 'ride', mode: 'bus', lineCode: '25G', color: '#000000', departureTime: '10:08', arrivalTime: '10:17',
  durationMinutes: 9, distanceMeters: 2000, stopCount: 4, board, alight,
  geometryQuality: 'exact', geometry: [board.coordinate, [40.99, 29.05], alight.coordinate],
};
const metro: Extract<TransitLeg, { kind: 'ride' }> = {
  ...bus, mode: 'metro', lineCode: 'M2', departureTime: '10:23', arrivalTime: '10:30',
  durationMinutes: 7, board: { ...alight, role: 'board' }, alight: lastStop,
  geometry: [alight.coordinate, lastStop.coordinate],
};
const itinerary: TransitItinerary = {
  departureTime: '10:00', arrivalTime: '10:35', durationMinutes: 35, walkingMinutes: 10, transferCount: 1,
  steps: [walk, bus, metro, {
    ...walk, departureTime: '10:30', arrivalTime: '10:35', geometry: [lastStop.coordinate, destination.coordinate],
  }],
  keyPoints: [origin, board, { ...alight, role: 'transfer' }, lastStop, destination],
  metadata: {
    dataVersion: 'fixture_v1', generatedAt: '2026-11-10T07:00:00Z', serviceDate: '2026-11-10',
    approximateWalking: true, geometryQuality: 'approximate',
  },
};

test('colors each leg by transit mode and dashes only approximate geometry', () => {
  const modes = ['bus', 'metro', 'tram', 'rail', 'ferry', 'funicular', 'minibus'] as const;
  const model = buildTransitMapModel({
    ...itinerary,
    steps: [walk, ...modes.map((mode) => ({ ...bus, mode })), { ...bus, geometryQuality: 'approximate' }],
  });

  assert.deepEqual(model.segments.map(({ mode, color, dashed }) => [mode, color, dashed]), [
    ['walking', '#6b7280', true],
    ['bus', '#f59e0b', false],
    ['metro', '#dc2626', false],
    ['tram', '#e11d48', false],
    ['rail', '#881337', false],
    ['ferry', '#2563eb', false],
    ['funicular', '#be123c', false],
    ['minibus', '#7c3aed', false],
    ['bus', '#f59e0b', true],
  ]);
  assert.deepEqual(model.segments[1].coordinates, [[41.01, 29.01], [40.99, 29.05], [41.02, 29.02]]);
  assert.equal(model.hasApproximateGeometry, true);
  assert.equal(buildTransitMapModel({ ...itinerary, steps: [bus] }).hasApproximateGeometry, false);
});

test('fits bounds to geometry and markers and leaves an empty map without bounds', () => {
  assert.deepEqual(buildTransitMapModel(itinerary).bounds, [[40.99, 29], [41.04, 29.05]]);
  assert.deepEqual(buildTransitMapModel({ ...itinerary, steps: [], keyPoints: [origin] }).bounds, [[41, 29], [41, 29]]);
  assert.equal(buildTransitMapModel({ ...itinerary, steps: [], keyPoints: [] }).bounds, null);
});

test('keeps exactly the API key points in order with their actions, scheduled times and modes', () => {
  const { markers } = buildTransitMapModel(itinerary);
  assert.deepEqual(markers.flatMap(({ points, coordinate }) => points.map(({ role, name, action, time, mode, lineCode }) => (
    [role, name, coordinate, action, time, mode, lineCode]
  ))), [
    ['origin', 'Başlangıç', [41, 29], 'Başlangıç', '10:00', 'walking', undefined],
    ['board', 'Çarşı', [41.01, 29.01], 'Biniş', '10:08', 'bus', '25G'],
    ['transfer', 'İskele', [41.02, 29.02], 'Aktarma', '10:17', 'bus', '25G'],
    ['alight', 'Meydan', [41.03, 29.03], 'İniş', '10:30', 'metro', 'M2'],
    ['destination', 'Hedef', [41.04, 29.04], 'Varış', '10:35', 'walking', undefined],
  ]);
  assert.equal(markers[1].points[0].code, '123456');
});

test('uses the time of each visit when a route passes the same stop again', () => {
  const secondBus = { ...bus, lineCode: '25A', departureTime: '11:08', arrivalTime: '11:17' };
  const { markers } = buildTransitMapModel({
    ...itinerary,
    steps: [bus, secondBus],
    keyPoints: [board, alight, board, alight],
  });
  assert.deepEqual(markers.map(({ points }) => points.map(({ time, lineCode }) => [time, lineCode])), [
    [['10:08', '25G'], ['11:08', '25A']],
    [['10:17', '25G'], ['11:17', '25A']],
  ]);
});

test('uses the walking leg arrival for a walk-only transfer key point', () => {
  const transfer = { role: 'transfer', name: 'Geçit', coordinate: [41.025, 29.025] } satisfies TransitBoardingPoint;
  const { markers } = buildTransitMapModel({
    ...itinerary,
    steps: [
      bus,
      { ...walk, departureTime: '10:17', arrivalTime: '10:24', geometry: [alight.coordinate, transfer.coordinate] },
      { ...walk, departureTime: '10:24', arrivalTime: '10:35', geometry: [transfer.coordinate, destination.coordinate] },
    ],
    keyPoints: [origin, board, alight, transfer, destination],
  });
  const point = markers[3].points[0];
  assert.equal(point.action, 'Aktarma');
  assert.equal(point.mode, 'walking');
  assert.equal(point.time, '10:24');
});

test('uses only validated stop URLs supplied on the key point', () => {
  const { markers } = buildTransitMapModel(itinerary);
  assert.equal(markers[1].points[0].href, canonicalUrl);
  assert.equal(Object.hasOwn(markers[2].points[0], 'href'), false);

  for (const unsafeUrl of [
    'javascript:alert(1)', '//example.com/otobus-duraklari/carsi-123456',
    'https://example.com/otobus-duraklari/carsi-123456',
    'https://hizliulasim.com/otobus-duraklari/beylerbeyi-219312',
    'https://hizliulasim.com/otobus-hatlari/25g',
  ]) {
    const { markers } = buildTransitMapModel({
      ...itinerary,
      keyPoints: [{ ...board, contentLink: { title: 'Çarşı', canonicalUrl: unsafeUrl } }],
    });
    assert.equal(Object.hasOwn(markers[0].points[0], 'href'), false, unsafeUrl);
  }
});

test('shares a marker between alighting and destination and preserves the stop link', () => {
  const stopUrl = '/otobus-duraklari/iskele-123458';
  const linkedStop = { ...alight, contentLink: { title: 'İskele Durağı', canonicalUrl: stopUrl } };
  const { markers } = buildTransitMapModel({
    ...itinerary,
    steps: [bus],
    arrivalTime: '10:17',
    keyPoints: [origin, board, linkedStop, { ...destination, coordinate: [...alight.coordinate] }],
  });
  assert.equal(markers.length, 3);
  assert.deepEqual(markers[2].coordinate, alight.coordinate);
  assert.deepEqual(markers[2].points.map(({ role, action, name, time, href }) => [role, action, name, time, href]), [
    ['alight', 'İniş', 'İskele', '10:17', stopUrl],
    ['destination', 'Varış', 'Hedef', '10:17', undefined],
  ]);
});

test('fits the chosen ride and highlights just its segment and endpoint markers', () => {
  const focus = buildTransitMapModel(itinerary, 1);
  assert.deepEqual(focus.bounds, [[40.99, 29.01], [41.02, 29.05]]);
  assert.deepEqual(focus.segments.map(({ highlighted }) => highlighted), [false, true, false, false]);
  assert.deepEqual(focus.markers.filter(({ highlighted }) => highlighted).map(({ coordinate }) => coordinate), [
    board.coordinate, alight.coordinate,
  ]);

  const transfer = buildTransitMapModel(itinerary, 2);
  assert.deepEqual(transfer.markers.filter(({ highlighted }) => highlighted).map(({ coordinate }) => coordinate), [
    alight.coordinate, lastStop.coordinate,
  ]);
});

test('highlights walking endpoints and restores full bounds when focus is cleared', () => {
  const walkFocus = buildTransitMapModel(itinerary, 0);
  assert.deepEqual(walkFocus.bounds, [[41, 29], [41.01, 29.01]]);
  assert.equal(walkFocus.segments[0].highlighted, true);
  assert.equal(walkFocus.segments[0].dashed, true);
  assert.deepEqual(walkFocus.markers.filter(({ highlighted }) => highlighted).map(({ coordinate }) => coordinate), [
    origin.coordinate, board.coordinate,
  ]);

  const fullRoute = buildTransitMapModel(itinerary, null);
  assert.deepEqual(fullRoute.bounds, [[40.99, 29], [41.04, 29.05]]);
  assert.equal(fullRoute.segments.some(({ highlighted }) => highlighted), false);
  assert.equal(fullRoute.markers.some(({ highlighted }) => highlighted), false);
  assert.deepEqual(buildTransitMapModel(itinerary, 99), fullRoute);
});

test('includes a ride’s actual boarding and alighting points even when they lie off the shape', () => {
  const focus = buildTransitMapModel({
    ...itinerary,
    steps: [{ ...bus, geometry: [[41.012, 29.015], [41.018, 29.019]] }],
  }, 0);
  assert.deepEqual(focus.bounds, [[41.01, 29.01], [41.02, 29.02]]);
  assert.equal(focus.markers.length, itinerary.keyPoints.length);
});
