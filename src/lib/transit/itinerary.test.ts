import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, type TestContext } from 'node:test';
import { gzipSync } from 'node:zlib';
import { parseManifest, type Coordinate, type TransitGeometry, type TransitManifest, type TransitStop } from './contracts.ts';
import { attachContentLink, buildItinerary, collectKeyPoints, mergeLegGeometry } from './itinerary.ts';
import { getModePresentation } from './presentation.ts';
import type { JourneySegment } from './router.ts';
import { clearTransitSnapshotCacheForTests, loadActiveSnapshot, TransitSnapshotError } from './snapshot-source.ts';
import { manifestFixture } from './test-fixtures.ts';

const coordinate = (longitude: number, latitude = 41): Coordinate => [latitude, longitude];
const before = coordinate(29.0005);
const board = coordinate(29.0015);
const middle = coordinate(29.003);
const alight = coordinate(29.0045);
const after = coordinate(29.006);
const station = coordinate(29.005);
const last = coordinate(29.008);
const origin = coordinate(29.001, 41.0001);
const destination = coordinate(29.0085, 41.0001);
const bend = coordinate(29.0025, 41.0003);
const cell = '4100_2900';
const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
const stopPath = `stops-grid/${sha256(cell)}.json.gz`;
const busRoutePath = `routes/${sha256('0')}.json.gz`;
const metroRoutePath = `routes/${sha256('metro')}.json.gz`;
const busPattern = sha256('bus pattern');
const metroPattern = sha256('metro pattern');
const busShape = sha256('official bus shape');
const metroShape = sha256('approximate metro shape');
const busPatternPath = `patterns/${busPattern}.json.gz`;
const metroPatternPath = `patterns/${metroPattern}.json.gz`;
const busShapePath = `shapes/${busShape}.json.gz`;
const metroShapePath = `shapes/${metroShape}.json.gz`;
const contentPath = 'content-links.json.gz';
const stationLink = { title: 'Durak sayfası', canonicalUrl: 'https://hizliulasim.com/otobus-duraklari/ornek-123456' };

function stop(stopId: string, [latitude, longitude]: Coordinate, stopCode: string | null = null): TransitStop {
  return { stopId, stopCode, latitude, longitude, name: `Durak ${stopId}` };
}

const stops = [stop('before', before), stop('0', board, 'alias'), stop('middle', middle),
  stop('alight', alight, '0'), stop('after', after), stop('station', station), stop('last', last),
  stop('other', coordinate(29.009), '123456')];
const stopsById = new Map(stops.map((value) => [value.stopId, value]));
const exactBusGeometry: TransitGeometry = {
  shapeId: busShape, sourceShapeId: 'source-bus', geometryQuality: 'exact',
  points: [before, board, bend, middle, alight, after],
};
const approximateMetroGeometry: TransitGeometry = {
  shapeId: metroShape, sourceShapeId: null, geometryQuality: 'approximate',
  points: [before, station, last, after],
};
const busPatternRecord = { patternId: busPattern, routeId: '0', directionId: '0',
  stopIds: ['before', '0', 'middle', 'middle', 'alight', 'after'], shapeIds: [busShape], tripIds: ['trip-bus'] };
const metroPatternRecord = { patternId: metroPattern, routeId: 'metro', directionId: '',
  stopIds: ['before', 'station', 'last', 'after'], shapeIds: [metroShape], tripIds: ['trip-metro'] };

function payloads() {
  return {
    [stopPath]: { cell, precision: 0.01, stops },
    [busRoutePath]: { routeId: '0', shortName: '500T', longName: 'Otobüs', routeType: 3, patternIds: [busPattern] },
    [metroRoutePath]: { routeId: 'metro', shortName: 'M1', longName: 'Metro', routeType: 1, patternIds: [metroPattern] },
    [busPatternPath]: { patterns: [busPatternRecord] },
    [metroPatternPath]: { patterns: [metroPatternRecord] },
    [busShapePath]: { shapes: [exactBusGeometry] },
    [metroShapePath]: { shapes: [approximateMetroGeometry] },
    [contentPath]: { schemaVersion: 1, links: { '0': stationLink } },
  };
}

function journey(): JourneySegment[] {
  const at = (minute: number, second = 0) => Date.parse('2026-11-10T21:00:00Z') + (minute * 60 + second) * 1000;
  const bus = { kind: 'ride' as const, tripId: 'trip-bus', routeId: '0', serviceId: '0', serviceDate: '2026-11-10',
    patternId: busPattern, shapeId: busShape, directionId: '0' as const, headsign: 'Merkez' };
  return [
    { kind: 'walk', role: 'access', fromCoordinate: origin, toStopId: '0',
      distanceMeters: 42, walkingSeconds: 39, departureEpochMs: at(5), arrivalEpochMs: at(5, 39) },
    { ...bus, fromStopId: '0', toStopId: 'middle', stopIds: ['0', 'middle'], stopSequence: 11, arrivalStopSequence: 15,
      departureEpochMs: at(7), arrivalEpochMs: at(11) },
    { ...bus, fromStopId: 'middle', toStopId: 'alight', stopIds: ['middle', 'alight'], stopSequence: 15, arrivalStopSequence: 25,
      departureEpochMs: at(12), arrivalEpochMs: at(16) },
    { kind: 'walk', role: 'transfer', fromStopId: 'alight', toStopId: 'station', evidence: { type: 'source', reference: 'T1' },
      distanceMeters: 43, walkingSeconds: 40, departureEpochMs: at(16), arrivalEpochMs: at(17, 40) },
    { kind: 'ride', tripId: 'trip-metro', routeId: 'metro', serviceId: '0', serviceDate: '2026-11-10',
      patternId: metroPattern, shapeId: metroShape, directionId: '', headsign: '', fromStopId: 'station', toStopId: 'last',
      stopIds: ['station', 'last'], stopSequence: 1, arrivalStopSequence: 2, departureEpochMs: at(19), arrivalEpochMs: at(25) },
    { kind: 'walk', role: 'egress', fromStopId: 'last', toCoordinate: destination,
      distanceMeters: 45, walkingSeconds: 41, departureEpochMs: at(25), arrivalEpochMs: at(25, 41) },
  ];
}

function snapshotStorage(t: TestContext) {
  clearTransitSnapshotCacheForTests();
  const env = process.env;
  const { TRANSIT_DATA_BASE_URL, TRANSIT_DATA_STORAGE_PATH } = env;
  env.TRANSIT_DATA_BASE_URL = 'https://itinerary-fixtures.invalid/';
  delete env.TRANSIT_DATA_STORAGE_PATH;
  t.after(() => {
    if (TRANSIT_DATA_BASE_URL === undefined) delete env.TRANSIT_DATA_BASE_URL;
    else env.TRANSIT_DATA_BASE_URL = TRANSIT_DATA_BASE_URL;
    if (TRANSIT_DATA_STORAGE_PATH === undefined) delete env.TRANSIT_DATA_STORAGE_PATH;
    else env.TRANSIT_DATA_STORAGE_PATH = TRANSIT_DATA_STORAGE_PATH;
  });
  const files = new Map<string, Buffer>();
  const reads: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    const path = url.pathname.slice(1);
    reads.push(path);
    const data = files.get(path);
    return data === undefined ? new Response(null, { status: 404 }) : new Response(new Uint8Array(data));
  });

  function publish(version: string, overrides: Record<string, unknown> = {}, omit?: string,
    changeIndexes?: (indexes: TransitManifest['indexes']) => void) {
    const manifest = structuredClone(parseManifest(manifestFixture));
    manifest.version = version;
    manifest.indexes.stops = Object.fromEntries(stops.map(({ stopId }) => [stopId, stopPath]));
    manifest.indexes.routes = { '0': busRoutePath, metro: metroRoutePath };
    manifest.indexes.patterns = { [busPattern]: busPatternPath, [metroPattern]: metroPatternPath };
    manifest.indexes.shapes = { [busShape]: busShapePath, [metroShape]: metroShapePath };
    manifest.indexes.sourceShapes = { 'source-bus': busShape };
    changeIndexes?.(manifest.indexes);
    manifest.counts.contentLinks = 1;
    for (const [path, payload] of Object.entries({ ...payloads(), ...overrides })) {
      const data = gzipSync(JSON.stringify(payload));
      if (path !== omit) files.set(`versions/${version}/${path}`, data);
      manifest.files[path] = { bytes: data.length, sha256: sha256(data) };
    }
    const text = JSON.stringify(manifest);
    files.set(`versions/${version}/manifest.json`, Buffer.from(text));
    files.set('current.json', Buffer.from(JSON.stringify({ version, manifestSha256: sha256(text) })));
  }

  return { publish, reads };
}

test('assembles walk, board and alight across a coalesced bus and a metro ride', async (t) => {
  snapshotStorage(t).publish('itinerary_v1');
  const segments = journey();
  const result = await buildItinerary(segments, await loadActiveSnapshot());
  assert.deepEqual(result.steps.map(({ kind, mode }) => [kind, mode]), [
    ['walk', 'walking'], ['ride', 'bus'], ['walk', 'walking'], ['ride', 'metro'], ['walk', 'walking'],
  ]);
  const rides = result.steps.filter((step) => step.kind === 'ride');
  assert.deepEqual(rides.map(({ board, alight, lineCode, stopCount }) => [board.stopId, alight.stopId, lineCode, stopCount]), [
    ['0', 'alight', '500T', 2], ['station', 'last', 'M1', 1],
  ]);
  assert.deepEqual(rides[0].board, { role: 'board', stopId: '0', name: 'Durak 0', code: 'alias', coordinate: board, contentLink: stationLink });
  assert.equal(rides[0].alight.role, 'alight');
  assert.equal(rides[1].alight.role, 'alight');
  assert.equal(segments[1].kind === 'ride' && segments[1].toStopId, 'middle');
});

test('uses only meaningful marker points, with supplied names and one marker for a same-stop change', async (t) => {
  const [access, first, second, transfer, metro, egress] = journey();
  assert.ok(metro.kind === 'ride' && transfer.kind === 'walk' && transfer.role === 'transfer');
  snapshotStorage(t).publish('itinerary_v1', { [metroPatternPath]: { patterns: [{ ...metroPatternRecord, stopIds: ['alight', 'last'] }] } });
  const result = await buildItinerary([access, first, second, { ...metro, fromStopId: 'alight', stopIds: ['alight', 'last'] }, egress],
    await loadActiveSnapshot(), { originName: 'Ev', destinationName: 'İş' });
  assert.deepEqual(result.keyPoints.map(({ role, stopId, name }) => [role, stopId, name]), [
    ['origin', undefined, 'Ev'], ['board', '0', 'Durak 0'], ['transfer', 'alight', 'Durak alight'],
    ['alight', 'last', 'Durak last'], ['destination', undefined, 'İş'],
  ]);
  assert.deepEqual(collectKeyPoints(result), result.keyPoints);
});

test('preserves a transfer walk endpoint even when the rider continues on foot', async (t) => {
  snapshotStorage(t).publish('itinerary_v1');
  const [access, first, second, transfer, , egress] = journey();
  assert.ok(egress.kind === 'walk' && egress.role === 'egress' && transfer.kind === 'walk');
  const result = await buildItinerary([access, first, second, transfer, { ...egress, fromStopId: 'station',
    departureEpochMs: transfer.arrivalEpochMs }], await loadActiveSnapshot());
  assert.deepEqual(result.keyPoints.map(({ role, stopId }) => [role, stopId]), [
    ['origin', undefined], ['board', '0'], ['alight', 'alight'], ['transfer', 'station'], ['destination', undefined],
  ]);
  assert.deepEqual(collectKeyPoints(result), result.keyPoints);
});

test('attaches only the exact internal stop ID, retaining the producer title and URL verbatim', async (t) => {
  const links = { '0': stationLink };
  assert.deepEqual(attachContentLink('0', links), stationLink);
  assert.equal(attachContentLink('00', links), undefined);
  assert.equal(attachContentLink('alias', links), undefined);
  assert.equal(attachContentLink('constructor', links), undefined);
  snapshotStorage(t).publish('itinerary_v1');
  const result = await buildItinerary(journey(), await loadActiveSnapshot());
  const ride = result.steps[1];
  assert.ok(ride.kind === 'ride');
  assert.equal(ride.alight.code, '0');
  assert.equal('contentLink' in ride.alight, false);
  assert.equal('contentLink' in ride, false);
  assert.equal('url' in ride, false);
  assert.equal(ride.lineCode, '500T');
});

test('clips official geometry at boarding and alighting, and rebuilds approximate shapes from ridden stops', async (t) => {
  snapshotStorage(t).publish('itinerary_v1');
  const result = await buildItinerary(journey(), await loadActiveSnapshot());
  assert.deepEqual(result.steps.map(({ geometry, geometryQuality }) => [geometry, geometryQuality]), [
    [[origin, board], 'approximate'], [[board, bend, middle, alight], 'exact'],
    [[alight, station], 'approximate'], [[station, last], 'approximate'], [[last, destination], 'approximate'],
  ]);
});

test('clips exact endpoints inside shape edges without adding unrelated line tails', () => {
  const [, first] = journey();
  const shape = { ...exactBusGeometry, points: [before, middle, after] };
  const [geometry] = mergeLegGeometry([first], { stops: stopsById, shapes: new Map([[busShape, shape]]) });
  assert.equal(geometry.geometryQuality, 'exact');
  assert.deepEqual(geometry.points, [board, middle]);
});

test('keeps the official segment between projected endpoints for slightly offset stops', () => {
  const [, first] = journey();
  const shape = { ...exactBusGeometry, points: [coordinate(29.0005, 41.0001), coordinate(29.006, 41.0001)] };
  const [geometry] = mergeLegGeometry([first], { stops: stopsById, shapes: new Map([[busShape, shape]]) });
  assert.equal(geometry.geometryQuality, 'exact');
  assert.deepEqual(geometry.points, [board, coordinate(29.0015, 41.0001), coordinate(29.003, 41.0001), middle]);
});

test('falls back for a loop entirely inside the boarding projection radius', () => {
  const [, first] = journey();
  const p = coordinate(29.0016);
  const q = coordinate(29.0017, 41.0001);
  const r = coordinate(29.00162, 41.0001);
  const shape = { ...exactBusGeometry, points: [before, board, p, q, r, p, middle, after] };
  const [geometry] = mergeLegGeometry([first], { stops: stopsById, shapes: new Map([[busShape, shape]]) });
  assert.equal(geometry.geometryQuality, 'approximate');
  assert.deepEqual(geometry.points, [board, middle]);
});

test('falls back for distinct alighting projections in one radius run with unique shape vertices', () => {
  const [, first] = journey();
  assert.ok(first.kind === 'ride');
  const a: Coordinate = [41, 28.997];
  const b: Coordinate = [41.000009, 29];
  const shape: TransitGeometry = { ...exactBusGeometry, points: [
    a, [41.00007, 28.99988], [40.99993, 29.00012], [41.00007, 29.00012], [40.99993, 28.99988], b,
  ] };
  const ride = { ...first, fromStopId: 'a', toStopId: 'b', stopIds: ['a', 'b'] };
  const [geometry] = mergeLegGeometry([ride], {
    stops: new Map([['a', stop('a', a)], ['b', stop('b', b)]]), shapes: new Map([[busShape, shape]]),
  });
  assert.equal(geometry.geometryQuality, 'approximate');
  assert.deepEqual(geometry.points, [a, b]);
});

test('bounds the number of exact stop projections and falls back to the complete ridden stop order', () => {
  const [, first] = journey();
  assert.ok(first.kind === 'ride');
  const points = Array.from({ length: 2_001 }, (_, index) => coordinate(29 + index * 0.000004));
  const ridden = points.filter((_, index) => index % 4 === 0).map((point, index) => stop(`large-${index}`, point));
  const stopIds = ridden.map(({ stopId }) => stopId);
  const ride = { ...first, stopIds, fromStopId: stopIds[0], toStopId: stopIds[stopIds.length - 1] };
  const shape = { ...exactBusGeometry, points };
  const [geometry] = mergeLegGeometry([ride], {
    stops: new Map(ridden.map((record) => [record.stopId, record])), shapes: new Map([[busShape, shape]]),
  });
  assert.equal(geometry.geometryQuality, 'approximate');
  assert.deepEqual(geometry.points, ridden.map(({ latitude, longitude }) => [latitude, longitude]));
});

test('falls back for a very long exact shape even with only two ridden stops', () => {
  const [, first] = journey();
  const points = Array.from({ length: 16_385 }, (_, index) => coordinate(29 + index * 0.0000005));
  const shape = { ...exactBusGeometry, points };
  const [geometry] = mergeLegGeometry([first], { stops: stopsById, shapes: new Map([[busShape, shape]]) });
  assert.equal(geometry.geometryQuality, 'approximate');
  assert.deepEqual(geometry.points, [board, middle]);
});

for (const [name, points] of Object.entries({
  reversed: [...exactBusGeometry.points].reverse(),
  loop: [before, board, bend, middle, alight, after, coordinate(29.007, 41.005), board, middle],
  'unmatched stop': [coordinate(29, 41.008), coordinate(29.009, 41.008)],
})) {
  test(`falls back to forward ridden stop coordinates for ${name} official geometry`, async (t) => {
    snapshotStorage(t).publish('itinerary_v1', { [busShapePath]: { shapes: [{ ...exactBusGeometry, points }] } });
    const result = await buildItinerary(journey(), await loadActiveSnapshot());
    assert.equal(result.steps[1].geometryQuality, 'approximate');
    assert.deepEqual(result.steps[1].geometry, [board, middle, alight]);
  });
}

test('uses Istanbul wall times, explicit overnight service date, per-mode colors and physical walking minutes', async (t) => {
  snapshotStorage(t).publish('itinerary_v1');
  const result = await buildItinerary(journey(), await loadActiveSnapshot(), { now: () => new Date('2026-11-11T12:34:56Z') });
  assert.deepEqual([result.departureTime, result.arrivalTime, result.durationMinutes, result.walkingMinutes, result.transferCount],
    ['00:05', '00:25', 21, 2, 1]);
  assert.deepEqual(result.metadata, { dataVersion: 'itinerary_v1', generatedAt: '2026-11-11T12:34:56.000Z',
    serviceDate: '2026-11-10', approximateWalking: true, geometryQuality: 'approximate' });
  assert.deepEqual(result.steps.map(({ durationMinutes, departureTime, arrivalTime }) => [durationMinutes, departureTime, arrivalTime]), [
    [1, '00:05', '00:05'], [9, '00:07', '00:16'], [2, '00:16', '00:17'], [6, '00:19', '00:25'], [1, '00:25', '00:25'],
  ]);
  const rides = result.steps.filter((step) => step.kind === 'ride');
  assert.deepEqual(rides.map(({ mode, color }) => [mode, color]), [['bus', '#f59e0b'], ['metro', '#dc2626']]);
  assert.ok(rides[0].distanceMeters > 250 && rides[0].distanceMeters < 300);
  assert.equal(result.keyPoints[0].name, 'Başlangıç');
  assert.equal(result.keyPoints.at(-1)?.name, 'Hedef');
});

test('uses elapsed transfer time on the step and physical walking time in the itinerary total', async (t) => {
  snapshotStorage(t).publish('itinerary_v1');
  const segments = journey();
  const transfer = segments[3];
  assert.ok(transfer.kind === 'walk' && transfer.role === 'transfer');
  transfer.arrivalEpochMs = transfer.departureEpochMs + 3_600_000;
  transfer.distanceMeters = 350;
  transfer.walkingSeconds = 319;
  for (const segment of segments.slice(4)) {
    segment.departureEpochMs += 3_500_000;
    segment.arrivalEpochMs += 3_500_000;
  }
  const result = await buildItinerary(segments, await loadActiveSnapshot());
  const step = result.steps[2];
  assert.deepEqual([step.distanceMeters, step.durationMinutes, step.departureTime, step.arrivalTime], [350, 60, '00:16', '01:16']);
  assert.equal(result.walkingMinutes, 7);
});

test('recognizes rail, tram, ferry, funicular and dolmuş route types from snapshot routes', async (t) => {
  const store = snapshotStorage(t);
  const route = payloads()[metroRoutePath];
  for (const [routeType, mode] of [[2, 'rail'], [0, 'tram'], [4, 'ferry'], [7, 'funicular'], [1501, 'minibus']] as const) {
    store.publish(`mode_${routeType}`, { [metroRoutePath]: { ...route, routeType } });
    const result = await buildItinerary(journey(), await loadActiveSnapshot());
    assert.equal(result.steps[3].mode, mode);
  }
});

test('recognizes cable car route types', async (t) => {
  const store = snapshotStorage(t);
  const route = payloads()[metroRoutePath];
  store.publish('mode_cable_car', { [metroRoutePath]: { ...route, routeType: 6 } });

  const result = await buildItinerary(journey(), await loadActiveSnapshot());

  assert.equal(result.steps[3].mode, 'cable_car');
  assert.deepEqual(getModePresentation('cable_car'), {
    label: 'Teleferik', color: '#9f1239', icon: 'cable-car',
  });
});

const fixture = payloads();
const pattern = busPatternRecord;
const integrityCases: [string, string, unknown][] = [
  ['a stop grid with a wrong cell', stopPath, { ...fixture[stopPath], cell: '4101_2900' }],
  ['a requested stop missing from its indexed grid', stopPath, { ...fixture[stopPath], stops: stops.slice(2) }],
  ['an unrelated indexed stop missing from its loaded grid', stopPath, { ...fixture[stopPath], stops: stops.slice(0, -1) }],
  ['a duplicate stop in the same grid', stopPath, { ...fixture[stopPath], stops: [...stops, stops[1]] }],
  ['a stop with invalid coordinates', stopPath, { ...fixture[stopPath], stops: [...stops.slice(0, -1), { ...stops.at(-1), longitude: 30 }] }],
  ['a route with the wrong ID', busRoutePath, { ...fixture[busRoutePath], routeId: 'metro' }],
  ['a route missing its ride pattern', busRoutePath, { ...fixture[busRoutePath], patternIds: [] }],
  ['an unsupported route type', busRoutePath, { ...fixture[busRoutePath], routeType: 99 }],
  ['a route with malformed labels', busRoutePath, { ...fixture[busRoutePath], shortName: 500 }],
  ['a pattern with the wrong ID', busPatternPath, { patterns: [{ ...pattern, patternId: metroPattern }] }],
  ['a pattern with the wrong route', busPatternPath, { patterns: [{ ...pattern, routeId: 'metro' }] }],
  ['a pattern with the wrong direction', busPatternPath, { patterns: [{ ...pattern, directionId: '1' }] }],
  ['a pattern skipping a ride stop', busPatternPath, { patterns: [{ ...pattern, stopIds: ['0', 'alight'] }] }],
  ['a pattern separating coalesced ride records across different loop passes', busPatternPath,
    { patterns: [{ ...pattern, stopIds: ['0', 'middle', 'after', 'middle', 'alight'] }] }],
  ['a pattern missing the trip', busPatternPath, { patterns: [{ ...pattern, tripIds: ['different-trip'] }] }],
  ['a pattern missing the shape', busPatternPath, { patterns: [{ ...pattern, shapeIds: [metroShape] }] }],
  ['a shape with the wrong ID', busShapePath, { shapes: [{ ...exactBusGeometry, shapeId: metroShape }] }],
  ['a shape with the wrong source identity', busShapePath, { shapes: [{ ...exactBusGeometry, sourceShapeId: 'different-source' }] }],
  ['a shape with malformed coordinates', busShapePath, { shapes: [{ ...exactBusGeometry, points: [board, [41, '29']] }] }],
  ['a content link with a non-stop URL', contentPath, { schemaVersion: 1, links: { '0': { ...stationLink, canonicalUrl: 'https://hizliulasim.com/500t' } } }],
  ['a content link with a different host', contentPath, { schemaVersion: 1, links: { '0': { ...stationLink, canonicalUrl: 'https://other.test/otobus-duraklari/ornek-123456' } } }],
  ['a content link keyed by a code instead of an internal ID', contentPath, { schemaVersion: 1, links: { alias: stationLink } }],
  ['a content link with a malformed title', contentPath, { schemaVersion: 1, links: { '0': { ...stationLink, title: 0 } } }],
  ['a content link with a known-broken frontend slug', contentPath,
    { schemaVersion: 1, links: { '0': { ...stationLink, canonicalUrl: 'https://hizliulasim.com/otobus-duraklari/beylerbeyi-219312' } } }],
];

for (const [name, path, payload] of integrityCases) {
  test(`rejects ${name} as a snapshot integrity error`, async (t) => {
    snapshotStorage(t).publish('itinerary_v1', { [path]: payload });
    const snapshot = await loadActiveSnapshot();
    await assert.rejects(buildItinerary(journey(), snapshot), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
  });
}

test('rejects a route index redirected to a composite content-links shard', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {
    [contentPath]: { ...fixture[contentPath], ...fixture[busRoutePath] },
  }, undefined, (indexes) => { indexes.routes['0'] = contentPath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

test('rejects a cross-kind alias on a loaded grid even when the aliased route is outside the journey', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {}, undefined, (indexes) => { indexes.routes.other = stopPath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

test('rejects a shape shard that also claims to be an indexed pattern collection', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {
    [busShapePath]: { ...fixture[busShapePath], ...fixture[busPatternPath] },
  }, undefined, (indexes) => { indexes.patterns[busPattern] = busShapePath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

for (const [kind, id, path, wrongPath] of [
  ['routes', '0', busRoutePath, `routes/${sha256('wrong route ID')}.json.gz`],
  ['patterns', busPattern, busPatternPath, `patterns/${sha256('wrong pattern ID')}.json.gz`],
  ['shapes', busShape, busShapePath, `shapes/${sha256('wrong shape ID')}.json.gz`],
] as const) {
  test(`rejects a ${kind} path with a filename derived from a different ID`, async (t) => {
    snapshotStorage(t).publish('itinerary_v1', { [wrongPath]: fixture[path] }, undefined,
      (indexes) => { indexes[kind][id] = wrongPath; });
    await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
  });
}

test('rejects an indexed pattern peer omitted from a loaded collection', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {}, undefined, (indexes) => { indexes.patterns[sha256('omitted')] = busPatternPath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

test('rejects an indexed route peer omitted from a loaded singleton', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {}, undefined, (indexes) => { indexes.routes.other = busRoutePath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

test('rejects an indexed shape peer omitted from a loaded collection', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {}, undefined, (indexes) => { indexes.shapes[sha256('omitted')] = busShapePath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

test('rejects an extra shape sharing a different ID’s exact indexed path', async (t) => {
  const otherShape = sha256('another shape');
  snapshotStorage(t).publish('itinerary_v1', {
    [busShapePath]: { shapes: [exactBusGeometry, { ...approximateMetroGeometry, shapeId: otherShape }] },
  }, undefined, (indexes) => { indexes.shapes[otherShape] = busShapePath; });
  await assert.rejects(buildItinerary(journey(), await loadActiveSnapshot()), { name: 'TransitSnapshotError', code: 'INVALID_SHARD' });
});

test('propagates a missing inventoried shard without returning a partial itinerary', async (t) => {
  snapshotStorage(t).publish('itinerary_v1', {}, busShapePath);
  const snapshot = await loadActiveSnapshot();
  await assert.rejects(buildItinerary(journey(), snapshot), TransitSnapshotError);
});

test('reads each necessary shard once from the pinned version even if current changes', async (t) => {
  const store = snapshotStorage(t);
  store.publish('itinerary_v1');
  const snapshot = await loadActiveSnapshot();
  // Clear startup cache to verify all itinerary reads, including the content-link inventory.
  clearTransitSnapshotCacheForTests();
  store.reads.length = 0;
  store.publish('itinerary_v2', { [busRoutePath]: { ...fixture[busRoutePath], shortName: 'NEW' } });
  const result = await buildItinerary(journey(), snapshot);
  assert.equal(result.metadata.dataVersion, 'itinerary_v1');
  assert.equal(result.steps[1].kind === 'ride' && result.steps[1].lineCode, '500T');
  assert.deepEqual([...store.reads].sort(), Object.keys(fixture).map((path) => `versions/itinerary_v1/${path}`).sort());
});
