import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { test, type TestContext } from 'node:test';
import { parseManifest, type TransitConnection, type TransitManifest, type TransitStop, type TransitTransfer } from './contracts.ts';
import type { ServiceDay } from './service-calendar.ts';
import { loadActiveSnapshot } from './snapshot-source.ts';
import { manifestFixture } from './test-fixtures.ts';
import {
  rankJourneys,
  routeTransitSnapshot,
  scanTransitConnections,
  type DatedConnection,
  type JourneySegment,
  type RouterInput,
} from './router.ts';

const serviceClass = 'a'.repeat(64);
const secondClass = 'b'.repeat(64);
const patternId = 'c'.repeat(64);
const shapeId = 'd'.repeat(64);
const hour = 3600;
const departureAt = new Date('2026-11-11T05:00:00Z');
const day: ServiceDay = {
  serviceDate: '2026-11-11', weekdayIndex: 2, anchorEpochMs: Date.parse('2026-11-10T21:00:00Z'),
  departureSeconds: 8 * hour,
};

function connection(tripId: string, fromStopId: string, toStopId: string, departure: number, arrival: number,
  overrides: Partial<TransitConnection> = {}): TransitConnection {
  return {
    tripId, fromStopId, toStopId, departure, arrival, routeId: '0', serviceId: '0', serviceClass,
    directionId: '0', headsign: 'Merkez', patternId, shapeId, stopSequence: 0, arrivalStopSequence: 1,
    pickupType: 0, dropOffType: 0, ...overrides,
  };
}

function ride(tripId: string, from: string, to: string, depart: number, arrive: number,
  overrides: Partial<TransitConnection> = {}, serviceDay = day): DatedConnection {
  return { day: serviceDay, connection: connection(tripId, from, to, 8 * hour + depart, 8 * hour + arrive, overrides) };
}

function walk(stopId: string, distanceMeters = 0, walkingSeconds = 0) {
  return { stopId, distanceMeters, walkingSeconds };
}

type QueryFixture = Omit<RouterInput, 'connections'>;

function query(overrides: Partial<QueryFixture> = {}): QueryFixture {
  return {
    departureAt, origin: [41, 29], destination: [41.01, 29],
    access: [walk('A')], egress: [walk('Z')], ...overrides,
  };
}

function journey(connections: DatedConnection[], overrides?: Partial<QueryFixture>): JourneySegment[] {
  const result = scanTransitConnections({ ...query(overrides), connections });
  assert.equal(result.status, 'ok');
  return result.journeys[0];
}

function trips(segments: JourneySegment[]) {
  return segments.flatMap((segment) => segment.kind === 'ride' ? [segment.tripId] : []);
}

function noRoute(connections: DatedConnection[], overrides?: Partial<QueryFixture>) {
  assert.equal(scanTransitConnections({ ...query(overrides), connections }).status, 'no-route');
}

test('boards a direct bus after the access walk and includes the egress walk', () => {
  const segments = journey([ride('T', 'A', 'Z', 80, 160)], {
    access: [walk('A', 55, 50)], egress: [walk('Z', 44, 40)],
  });
  assert.deepEqual(segments.map((segment) => [segment.kind, segment.departureEpochMs - +departureAt,
    segment.arrivalEpochMs - +departureAt]), [['walk', 0, 50_000], ['ride', 80_000, 160_000], ['walk', 160_000, 200_000]]);
  assert.equal(segments[0].kind === 'walk' && segments[0].role === 'access' && segments[0].toStopId, 'A');
  assert.equal(segments[2].kind === 'walk' && segments[2].role === 'egress' && segments[2].fromStopId, 'Z');
});

test('misses a bus one second before the access boarding buffer elapses', () => {
  noRoute([ride('T', 'A', 'Z', 79, 160)], { access: [walk('A', 55, 50)] });
});

test('changes vehicles at the same stop after the minimum change time', () => {
  const first = ride('T1', 'A', 'B', 30, 100);
  assert.deepEqual(trips(journey([first, ride('T2', 'B', 'Z', 160, 200)])), ['T1', 'T2']);
  noRoute([first, ride('T2', 'B', 'Z', 159, 200)]);
});

test('uses the producer transfer duration once and preserves the walking evidence', () => {
  const transfer: TransitTransfer = {
    fromStopId: 'B', toStopId: 'C', seconds: 111, distanceMeters: 56,
    evidence: { type: 'source', reference: 'fixture-station' },
  };
  const first = ride('T1', 'A', 'B', 30, 100);
  const result = journey([first, ride('T2', 'C', 'Z', 211, 300)], { transfers: [transfer] });
  const segment = result[2];
  assert.ok(segment.kind === 'walk' && segment.role === 'transfer');
  assert.equal(segment.arrivalEpochMs - segment.departureEpochMs, 111_000);
  assert.equal(segment.walkingSeconds, 51);
  assert.deepEqual(segment.evidence, transfer.evidence);
  noRoute([first, ride('T2', 'C', 'Z', 210, 300)], { transfers: [transfer] });
});

test('allows two changes and enforces tighter and absolute boarding caps', () => {
  const network = [ride('T1', 'A', 'B', 30, 100), ride('T2', 'B', 'C', 160, 200),
    ride('T3', 'C', 'Z', 260, 300), ride('T4', 'Z', 'Y', 360, 400)];
  assert.deepEqual(trips(journey(network)), ['T1', 'T2', 'T3']);
  noRoute(network, { limits: { maxBoardings: 2 } });
  noRoute(network, { egress: [walk('Y')] });
  assert.throws(() => scanTransitConnections({ ...query({ limits: { maxBoardings: 4 } }), connections: network }), RangeError);
});

test('continues on the same dated vehicle through restricted intermediate stops', () => {
  const first = ride('T', 'A', 'B', 30, 100, { dropOffType: 1, arrivalStopSequence: 5 });
  const second = ride('T', 'B', 'Z', 100, 200, { pickupType: 1, stopSequence: 5, arrivalStopSequence: 9 });
  const segments = journey([second, first], { limits: { maxBoardings: 1 } });
  const segment = segments[1];
  assert.ok(segment.kind === 'ride');
  assert.deepEqual([segment.tripId, segment.serviceDate, segment.stopIds, segment.stopSequence, segment.arrivalStopSequence],
    ['T', '2026-11-11', ['A', 'B', 'Z'], 0, 9]);
});

test('does not continue a repeated trip ID across service dates', () => {
  const previous: ServiceDay = { ...day, serviceDate: '2026-11-10', weekdayIndex: 1,
    anchorEpochMs: day.anchorEpochMs - 24 * hour * 1000 };
  noRoute([ride('T', 'A', 'B', 24 * hour + 30, 24 * hour + 100, {}, previous),
    ride('T', 'B', 'Z', 100, 200, { pickupType: 1, stopSequence: 1, arrivalStopSequence: 2 })]);
});

test('requires the next edge to connect the same stop sequence for vehicle continuity', () => {
  noRoute([ride('T', 'A', 'B', 30, 100, { dropOffType: 1 }),
    ride('T', 'B', 'Z', 100, 200, { pickupType: 1, stopSequence: 3, arrivalStopSequence: 4 })]);
});

test('cannot board or alight with a non-regular pickup or drop-off policy', () => {
  for (const type of [1, 2, 3] as const) {
    noRoute([ride('T', 'A', 'Z', 30, 200, { pickupType: type })]);
    noRoute([ride('T', 'A', 'Z', 30, 200, { dropOffType: type })]);
  }
});

test('rejects a repeated stop in a through journey and a zero-duration ride', () => {
  noRoute([ride('T', 'A', 'B', 30, 100),
    ride('T', 'B', 'A', 100, 150, { stopSequence: 1, arrivalStopSequence: 2 }),
    ride('T', 'A', 'Z', 150, 200, { pickupType: 1, stopSequence: 2, arrivalStopSequence: 3 })]);
  noRoute([ride('T', 'A', 'Z', 30, 30)]);
  assert.throws(() => scanTransitConnections({ ...query(), connections: [ride('T', 'A', 'Z', 90, 80)] }),
    { code: 'INVALID_SHARD' });
  assert.throws(() => scanTransitConnections({ ...query({ transfers: [{ fromStopId: 'B', toStopId: 'Z', seconds: 0,
    distanceMeters: 0, evidence: { type: 'manual', reference: 'fixture' } }] }), connections: [] }), { code: 'INVALID_SHARD' });
});

test('reports no route for an unreachable destination or for egress beyond the horizon', () => {
  noRoute([ride('T', 'A', 'B', 30, 80)]);
  noRoute([ride('T', 'A', 'Z', 30, 80)], { limits: { horizonSeconds: 99 }, egress: [walk('Z', 22, 20)] });
  assert.deepEqual(trips(journey([ride('T', 'A', 'Z', 30, 80)], {
    limits: { horizonSeconds: 100 }, egress: [walk('Z', 22, 20)],
  })), ['T']);
});

test('preserves incomparable arrival labels whose walking and readiness differ', () => {
  const connections = [ride('walk-more', 'A', 'B', 100, 150), ride('walk-less', 'X', 'B', 100, 200),
    ride('change', 'B', 'Z', 230, 300)];
  assert.deepEqual(trips(journey(connections, { access: [walk('A', 55, 50), walk('X')] })), ['walk-more', 'change']);
  assert.deepEqual(trips(journey(connections.slice(0, 2).concat(ride('change', 'B', 'Z', 260, 300)), {
    access: [walk('A', 55, 50), walk('X')],
  })), ['walk-less', 'change']);
});

test('keeps an offboard arrival that can visit a stop another arrival already visited', () => {
  const connections = [ride('early', 'A', 'B', 30, 80), ride('via-X', 'X', 'B', 40, 90),
    ride('middle', 'B', 'A', 150, 200, { dropOffType: 1 }),
    ride('middle', 'A', 'Z', 200, 300, { pickupType: 1, stopSequence: 1, arrivalStopSequence: 2 })];
  assert.deepEqual(trips(journey(connections, { access: [walk('A'), walk('X')] })), ['via-X', 'middle']);
  assert.deepEqual(scanTransitConnections({ ...query({ access: [walk('A'), walk('X')], limits: { maxLabelsPerStop: 1 } }),
    connections }), { status: 'budget-exceeded', budget: 'stop-labels' });
});

test('keeps a tied onboard arrival that can ride through a stop another arrival already visited', () => {
  const connections = [ride('T', 'A', 'B', 30, 60),
    ride('T', 'B', 'C', 70, 110, { dropOffType: 1, stopSequence: 1, arrivalStopSequence: 2 }),
    ride('T', 'C', 'A', 120, 150, { pickupType: 1, dropOffType: 1, stopSequence: 2, arrivalStopSequence: 3 }),
    ride('T', 'A', 'Z', 160, 200, { pickupType: 1, stopSequence: 3, arrivalStopSequence: 4 })];
  const segments = journey(connections, { access: [walk('A'), walk('B')] });
  const segment = segments[1];
  assert.ok(segment.kind === 'ride');
  assert.deepEqual(segment.stopIds, ['B', 'C', 'A', 'Z']);
});

test('keeps equal stop histories when the dated trips already boarded differ', () => {
  const connections = [ride('T', 'A', 'B', 30, 80), ride('other', 'A', 'B', 40, 90),
    ride('T', 'B', 'A', 85, 110, { pickupType: 1, stopSequence: 1, arrivalStopSequence: 2 }),
    ride('T', 'A', 'C', 110, 290, { pickupType: 1, stopSequence: 2, arrivalStopSequence: 3 }),
    ride('connector', 'B', 'C', 150, 200),
    ride('T', 'C', 'Z', 290, 350, { stopSequence: 3, arrivalStopSequence: 4 })];
  assert.deepEqual(trips(journey(connections)), ['other', 'connector', 'T']);
});

test('preserves zero-time dated edges through restricted stops within a positive-duration ride', () => {
  const connections = [ride('T', 'A', 'B', 30, 100, { dropOffType: 1 }),
    ride('T', 'B', 'C', 100, 100, { pickupType: 1, dropOffType: 1, stopSequence: 1, arrivalStopSequence: 2 }),
    ride('T', 'C', 'Z', 100, 200, { pickupType: 1, stopSequence: 2, arrivalStopSequence: 3 })];
  const segment = journey(connections)[1];
  assert.ok(segment.kind === 'ride');
  assert.deepEqual(segment.stopIds, ['A', 'B', 'C', 'Z']);
  assert.equal(segment.arrivalEpochMs - segment.departureEpochMs, 170_000);
});

test('preserves a zero-time stop-sequence advance at the same physical stop', () => {
  const connections = [ride('T', 'A', 'B', 30, 100, { dropOffType: 1 }),
    ride('T', 'B', 'B', 100, 100, { pickupType: 1, dropOffType: 1, stopSequence: 1, arrivalStopSequence: 2 }),
    ride('T', 'B', 'Z', 100, 200, { pickupType: 1, stopSequence: 2, arrivalStopSequence: 3 })];
  const segment = journey(connections)[1];
  assert.ok(segment.kind === 'ride');
  assert.deepEqual(segment.stopIds, ['A', 'B', 'Z']);
  assert.equal(segment.arrivalStopSequence, 3);
});

test('allows a through passenger to alight after a zero-time edge at the horizon', () => {
  const connections = [ride('T', 'A', 'B', 30, 100, { dropOffType: 1 }),
    ride('T', 'B', 'Z', 100, 100, { pickupType: 1, stopSequence: 1, arrivalStopSequence: 2 })];
  const segment = journey(connections, { limits: { horizonSeconds: 100 } })[1];
  assert.ok(segment.kind === 'ride');
  assert.deepEqual(segment.stopIds, ['A', 'B', 'Z']);
});

test('ranks the same capped set by each preference and deduplicates repeated connections', () => {
  const connections = [ride('fast', 'A', 'F', 100, 200), ride('fast-change', 'F', 'Z', 260, 300),
    ride('walk-less', 'X', 'L', 30, 200), ride('walk-less-change', 'L', 'M', 260, 300),
    ride('walk-less-third', 'M', 'Z', 360, 400), ride('direct', 'Y', 'Z', 100, 500),
    ride('middle', 'J', 'N', 80, 200), ride('middle-change', 'N', 'Z', 260, 350),
    ride('direct', 'Y', 'Z', 100, 500)];
  const access = [walk('A', 55, 50), walk('X'), walk('Y', 22, 20), walk('J', 33, 30)];
  const outcomes = (['fastest', 'less-walking', 'fewer-transfers'] as const).map((preference) => {
    const result = scanTransitConnections({ ...query({ access, preference }), connections });
    assert.equal(result.status, 'ok');
    return result.journeys;
  });
  assert.deepEqual(outcomes.map((items) => items.map((item) => trips(item)[0])), [
    ['fast', 'walk-less', 'direct'], ['walk-less', 'direct', 'fast'], ['direct', 'fast', 'walk-less'],
  ]);
  assert.deepEqual(rankJourneys(outcomes[0], 'less-walking'), outcomes[1]);
  const tighter = scanTransitConnections({ ...query({ access, limits: { maxAlternatives: 1 } }), connections });
  assert.equal(tighter.status, 'ok');
  assert.deepEqual(tighter.journeys.map(trips), [['fast', 'fast-change']]);
});

test('exposes per-stop and total label budget exhaustion', () => {
  const network = [ride('early', 'A', 'B', 100, 150), ride('less-walk', 'X', 'B', 100, 200), ride('end', 'B', 'Z', 260, 300)];
  const access = [walk('A', 55, 50), walk('X')];
  assert.deepEqual(scanTransitConnections({ ...query({ access, limits: { maxLabelsPerStop: 1 } }), connections: network }),
    { status: 'budget-exceeded', budget: 'stop-labels' });
  assert.deepEqual(scanTransitConnections({ ...query({ access, limits: { maxTotalLabels: 1 } }), connections: network }),
    { status: 'budget-exceeded', budget: 'total-labels' });
});

test('rejects over-cap limit overrides', () => {
  for (const limits of [{ horizonSeconds: 21601 }, { maxBuckets: 33 }, { maxTransferShards: 65 }, { maxLabelsPerStop: 9 },
    { maxTotalLabels: 100001 }, { maxAlternatives: 4 }, { wallTimeMs: 1501 }]) {
    assert.throws(() => scanTransitConnections({ ...query({ limits }), connections: [] }), RangeError);
  }
});

function hash(bytes: string | Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function bucket(id: string, serviceHour: number) {
  return `${id}-${String(serviceHour).padStart(2, '0')}`;
}

const stopGrids: Record<string, TransitStop[]> = {
  '4100_2900': [
    { stopId: 'A', latitude: 41, longitude: 29, name: 'A', stopCode: null },
    { stopId: 'B', latitude: 41.0097, longitude: 29, name: 'B', stopCode: null },
    { stopId: 'X', latitude: 41.003, longitude: 29, name: 'X', stopCode: null },
    { stopId: 'Y', latitude: 41.005, longitude: 29, name: 'Y', stopCode: null },
  ],
  '4101_2900': [
    { stopId: 'C', latitude: 41.0102, longitude: 29, name: 'C', stopCode: null },
    { stopId: 'Z', latitude: 41.012, longitude: 29, name: 'Z', stopCode: null },
  ],
};

function publishedManifest(): TransitManifest {
  const fixture = parseManifest(structuredClone(manifestFixture));
  fixture.indexes.stops = {};
  for (const [cell, stops] of Object.entries(stopGrids)) {
    const stopPath = fixture.indexes.stopGrid[cell] = `stops-grid/${hash(cell)}.json.gz`;
    fixture.indexes.transfers[cell] = `transfers/${hash(cell)}.json.gz`;
    for (const stop of stops) fixture.indexes.stops[stop.stopId] = stopPath;
  }
  fixture.indexes.connectionBuckets = {};
  delete fixture.files[`connections/${bucket(serviceClass, 25)}.json.gz`];
  fixture.serviceDateRange = { start: '2026-11-08', end: '2026-11-15' };
  fixture.indexes.serviceClasses[serviceClass] = {
    serviceIds: ['0', 'same-class'],
    calendar: { weekdays: [1, 1, 1, 1, 1, 1, 1], startDate: '2026-11-08', endDate: '2026-11-15', addedDates: [], removedDates: [] },
  };
  fixture.indexes.calendarRules['same-class'] = serviceClass;
  return fixture;
}

function publishedStorage(t: TestContext) {
  const files = new Map<string, string | Buffer>();
  const reads: string[] = [];
  const environment = { base: process.env.TRANSIT_DATA_BASE_URL, local: process.env.TRANSIT_DATA_STORAGE_PATH };
  process.env.TRANSIT_DATA_BASE_URL = 'https://router-fixtures.invalid/';
  delete process.env.TRANSIT_DATA_STORAGE_PATH;
  t.after(() => {
    if (environment.base === undefined) delete process.env.TRANSIT_DATA_BASE_URL;
    else process.env.TRANSIT_DATA_BASE_URL = environment.base;
    if (environment.local === undefined) delete process.env.TRANSIT_DATA_STORAGE_PATH;
    else process.env.TRANSIT_DATA_STORAGE_PATH = environment.local;
  });
  let onRead: ((path: string) => Promise<void> | void) | undefined;
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    const path = url.pathname.slice(1);
    reads.push(path);
    await onRead?.(path);
    const file = files.get(path);
    return file === undefined ? new Response(null, { status: 404 }) : new Response(new Blob([typeof file === 'string' ? file : new Uint8Array(file)]));
  });

  function publish(manifest: TransitManifest, version: string, payloads: Record<string, unknown>,
    transferEdges: readonly TransitTransfer[] = []) {
    manifest.version = version;
    const payloadsByPath = { ...Object.fromEntries(Object.entries(payloads).map(([key, payload]) => {
      const path = `connections/${key}.json.gz`;
      manifest.indexes.connectionBuckets[key] = path;
      return [path, payload];
    })), 'content-links.json.gz': { schemaVersion: 1, links: {} } } as Record<string, unknown>;
    for (const [cell, stops] of Object.entries(stopGrids)) {
      const stopPath = manifest.indexes.stopGrid[cell];
      payloadsByPath[stopPath] = { cell, precision: 0.01, stops };
      payloadsByPath[manifest.indexes.transfers[cell]] = {
        cell, transfers: transferEdges.filter((edge) => manifest.indexes.stops[edge.fromStopId] === stopPath),
      };
    }
    for (const [path, payload] of Object.entries(payloadsByPath)) {
      const data = gzipSync(JSON.stringify(payload));
      files.set(`versions/${version}/${path}`, data);
      manifest.files[path] = { bytes: data.length, sha256: hash(data) };
    }
    const text = JSON.stringify(manifest);
    files.set(`versions/${version}/manifest.json`, text);
    files.set('current.json', JSON.stringify({ version, manifestSha256: hash(text) }));
  }

  return { files, publish, reads, onRead: (callback: typeof onRead) => { onRead = callback; } };
}

test('skips inactive weekly and removed service buckets and reads added service', async (t) => {
  const storage = publishedStorage(t);
  const manifest = publishedManifest();
  manifest.indexes.serviceClasses[serviceClass].calendar = {
    weekdays: [0, 0, 1, 0, 0, 0, 0], startDate: '2026-11-08', endDate: '2026-11-15',
    removedDates: ['2026-11-11'], addedDates: ['2026-11-12'],
  };
  const payload = { connections: [connection('T', 'A', 'Z', 8 * hour + 30, 8 * hour + 120)] };
  storage.publish(manifest, 'calendar_fixture', { [bucket(serviceClass, 8)]: payload });
  const snapshot = await loadActiveSnapshot();
  for (const date of ['2026-11-10T05:00:00Z', '2026-11-11T05:00:00Z']) {
    assert.equal((await routeTransitSnapshot(snapshot, query({ departureAt: new Date(date) }))).status, 'no-route');
  }
  assert.equal(storage.reads.some((path) => path.includes('/connections/')), false);
  const added = await routeTransitSnapshot(snapshot, query({ departureAt: new Date('2026-11-12T05:00:00Z') }));
  assert.equal(added.status, 'ok');
  const firstRide = added.journeys[0][1];
  assert.ok(firstRide.kind === 'ride');
  assert.equal(firstRide.serviceDate, '2026-11-12');
});

test('instantiates 24:xx and 48:xx buckets in order across midnight and keeps the captured version', async (t) => {
  const storage = publishedStorage(t);
  const manifest = publishedManifest();
  const calendar = manifest.indexes.serviceClasses[serviceClass].calendar;
  calendar.removedDates = ['2026-11-11'];
  const class2 = manifest.indexes.serviceClasses[secondClass] = {
    serviceIds: ['other'], calendar: { ...calendar, addedDates: ['2026-11-11'], removedDates: [] },
  };
  class2.calendar.weekdays = [0, 0, 0, 0, 0, 0, 0];
  manifest.indexes.calendarRules.other = secondClass;
  const early = bucket(serviceClass, 47);
  const midnight = bucket(serviceClass, 48);
  const priorDay = bucket(secondClass, 24);
  const nextDate = bucket(serviceClass, 0);
  storage.publish(manifest, 'before_swap', {
    [priorDay]: { connections: [connection('third', 'C', 'Z', 24 * hour + 500, 24 * hour + 800,
      { serviceId: 'other', serviceClass: secondClass })] },
    [nextDate]: { connections: [connection('second', 'B', 'C', 200, 400, { serviceId: 'same-class' })] },
    [midnight]: { connections: [connection('early', 'X', 'Y', 48 * hour + 20, 48 * hour + 60)] },
    [early]: { connections: [connection('first', 'A', 'B', 48 * hour - 300, 48 * hour - 40)] },
  });
  const snapshot = await loadActiveSnapshot();
  storage.publish(publishedManifest(), 'after_swap', {});
  const result = await routeTransitSnapshot(snapshot, query({ departureAt: new Date('2026-11-11T20:50:00Z') }));
  assert.equal(result.status, 'ok');
  assert.deepEqual(trips(result.journeys[0]), ['first', 'second', 'third']);
  assert.deepEqual(result.journeys[0].flatMap((item) => item.kind === 'ride' ? [item.serviceDate] : []),
    ['2026-11-10', '2026-11-12', '2026-11-11']);
  const reads = storage.reads.filter((path) => path.includes('/connections/'));
  assert.equal(reads.length, 4);
  assert.ok(reads[0].endsWith(`${early}.json.gz`));
  assert.ok(reads.every((path) => path.startsWith('versions/before_swap/')));
});

test('does not load later buckets after an earliest possible zero-walk single-vehicle result', async (t) => {
  const storage = publishedStorage(t);
  const manifest = publishedManifest();
  storage.publish(manifest, 'early_stop', {
    [bucket(serviceClass, 8)]: { connections: [connection('T', 'A', 'Z', 8 * hour + 30, 8 * hour + 60)] },
    [bucket(serviceClass, 9)]: { connections: null },
    [bucket(serviceClass, 14)]: { connections: null },
  });
  const result = await routeTransitSnapshot(await loadActiveSnapshot(), query({ limits: { horizonSeconds: 2 * hour } }));
  assert.equal(result.status, 'ok');
  assert.equal(storage.reads.filter((path) => path.includes('/connections/')).length, 1);
});

test('propagates malformed in-window connection payloads, records and membership', async (t) => {
  const storage = publishedStorage(t);
  const base = connection('T', 'A', 'Z', 8 * hour + 30, 8 * hour + 60);
  const invalid = [
    { other: [] }, { connections: [] }, { connections: [null] }, { connections: [{ ...base, pickupType: 4 }] },
    { connections: [{ ...base, serviceId: 'not-active' }] }, { connections: [{ ...base, serviceClass: secondClass }] },
    { connections: [{ ...base, departure: 7 * hour }] }, { connections: [{ ...base, arrival: 72 * hour }] },
    { connections: [{ ...base, arrivalStopSequence: 0 }] }, { connections: [{ ...base, toStopId: 'unknown' }] },
    { connections: [base, { ...base, toStopId: 'Y' }] },
  ];
  for (const [index, payload] of invalid.entries()) {
    storage.publish(publishedManifest(), `bad_bucket_${index}`, { [bucket(serviceClass, 8)]: payload });
    await assert.rejects(routeTransitSnapshot(await loadActiveSnapshot(), query()), { code: 'INVALID_SHARD' });
  }
  storage.publish(publishedManifest(), 'bad_digest', { [bucket(serviceClass, 8)]: { connections: [base] } });
  const snapshot = await loadActiveSnapshot();
  const key = `versions/bad_digest/connections/${bucket(serviceClass, 8)}.json.gz`;
  const bytes = Buffer.from(storage.files.get(key)!);
  bytes[bytes.length - 1] ^= 1;
  storage.files.set(key, bytes);
  await assert.rejects(routeTransitSnapshot(snapshot, query()), { code: 'SHARD_HASH' });
});

test('rejects overlapping edges for the same dated trip across buckets', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'overlapping_trip', {
    [bucket(serviceClass, 8)]: { connections: [connection('T', 'A', 'B', 9 * hour - 100, 9 * hour + 40)] },
    [bucket(serviceClass, 9)]: { connections: [connection('T', 'B', 'Z', 9 * hour + 20, 9 * hour + 60,
      { stopSequence: 1, arrivalStopSequence: 2 })] },
  });
  await assert.rejects(routeTransitSnapshot(await loadActiveSnapshot(), query()), { code: 'INVALID_SHARD' });
});

test('validates pre-query edges of a loaded dated trip before clipping to the request', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'clipped_overlap', {
    [bucket(serviceClass, 8)]: { connections: [
      connection('T', 'A', 'B', 8 * hour + 14 * 60, 8 * hour + 17 * 60),
      connection('T', 'B', 'Z', 8 * hour + 16 * 60, 8 * hour + 20 * 60, { stopSequence: 1, arrivalStopSequence: 2 }),
    ] },
  });
  await assert.rejects(routeTransitSnapshot(await loadActiveSnapshot(), query({
    departureAt: new Date('2026-11-11T05:15:00Z'), access: [walk('B')],
  })), { code: 'INVALID_SHARD' });
});

test('reads a horizon-boundary bucket for a zero-time alighting edge', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'horizon_alighting', {
    [bucket(serviceClass, 8)]: { connections: [connection('T', 'A', 'B', 9 * hour - 120, 9 * hour, { dropOffType: 1 })] },
    [bucket(serviceClass, 9)]: { connections: [connection('T', 'B', 'Z', 9 * hour, 9 * hour,
      { pickupType: 1, stopSequence: 1, arrivalStopSequence: 2 })] },
  });
  const result = await routeTransitSnapshot(await loadActiveSnapshot(), query({ limits: { horizonSeconds: hour } }));
  assert.equal(result.status, 'ok');
  assert.deepEqual(trips(result.journeys[0]), ['T']);
  assert.equal(result.journeys[0].at(-1)?.arrivalEpochMs, +departureAt + hour * 1000);
});

test('requires the producer bucket sort tuple before routing or clipping records', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'unordered_bucket', {
    [bucket(serviceClass, 8)]: { connections: [
      connection('Z-first', 'A', 'Z', 8 * hour + 30, 8 * hour + 60),
      connection('A-second', 'A', 'Z', 8 * hour + 30, 8 * hour + 60),
    ] },
  });
  await assert.rejects(routeTransitSnapshot(await loadActiveSnapshot(), query()), { code: 'INVALID_SHARD' });
});

const stationTransfer: TransitTransfer = {
  fromStopId: 'B', toStopId: 'C', distanceMeters: 56, seconds: 111,
  evidence: { type: 'source', reference: 'fixture-station' },
};

const transferConnections = { [bucket(serviceClass, 8)]: { connections: [
  connection('T1', 'A', 'B', 8 * hour + 30, 8 * hour + 100),
  connection('T2', 'C', 'Z', 8 * hour + 211, 8 * hour + 300),
] } };

test('loads the intermediate transfer and its stop grids from the captured snapshot', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'pinned_transfer', transferConnections, [stationTransfer]);
  const snapshot = await loadActiveSnapshot();
  storage.publish(publishedManifest(), 'new_pointer', transferConnections);
  const result = await routeTransitSnapshot(snapshot, query());
  assert.equal(result.status, 'ok');
  assert.deepEqual(trips(result.journeys[0]), ['T1', 'T2']);
  assert.deepEqual(result.journeys[0][2], {
    kind: 'walk', role: 'transfer', fromStopId: 'B', toStopId: 'C', distanceMeters: 56, walkingSeconds: 51,
    departureEpochMs: +departureAt + 100_000, arrivalEpochMs: +departureAt + 211_000, evidence: stationTransfer.evidence,
  });
  const transferReads = storage.reads.filter((path) => path.includes('/transfers/'));
  assert.deepEqual(transferReads, [`versions/pinned_transfer/transfers/${hash('4100_2900')}.json.gz`,
    `versions/pinned_transfer/transfers/${hash('4101_2900')}.json.gz`]);
  assert.equal(result.diagnostics.transferShards, 2);
});

test('ignores a caller-provided transfer absent from the pinned snapshot', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'no_published_transfer', transferConnections);
  const result = await routeTransitSnapshot(await loadActiveSnapshot(), query({ transfers: [stationTransfer] }));
  assert.equal(result.status, 'no-route');
});

test('returns a transfer-shard budget result when an intermediate expansion needs another cell', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'transfer_budget', transferConnections, [stationTransfer]);
  const result = await routeTransitSnapshot(await loadActiveSnapshot(), query({ limits: { maxTransferShards: 1 } }));
  assert.equal(result.status, 'budget-exceeded');
  assert.equal(result.status === 'budget-exceeded' && result.budget, 'transfer-shards');
  assert.equal(result.diagnostics.transferShards, 1);
  assert.equal(storage.reads.filter((path) => path.includes('/transfers/')).length, 1);
});

test('counts intersecting dated buckets and aborts a request with a depleted bucket budget', async (t) => {
  const storage = publishedStorage(t);
  storage.publish(publishedManifest(), 'bucket_budget', {
    [bucket(serviceClass, 8)]: { connections: [connection('T', 'A', 'B', 8 * hour + 30, 8 * hour + 60)] },
    [bucket(serviceClass, 9)]: { connections: [connection('T2', 'B', 'Z', 9 * hour, 9 * hour + 60)] },
    [bucket(serviceClass, 11)]: { connections: null },
  });
  const snapshot = await loadActiveSnapshot();
  assert.deepEqual(await routeTransitSnapshot(snapshot, query({ limits: { maxBuckets: 1, horizonSeconds: 2 * hour } })),
    { status: 'budget-exceeded', budget: 'buckets', diagnostics: { connectionBuckets: 1, connectionShards: 1, transferShards: 1 } });
  const result = await routeTransitSnapshot(snapshot, query({ limits: { maxBuckets: 2, horizonSeconds: 2 * hour } }));
  assert.equal(result.status, 'ok');
  assert.deepEqual(trips(result.journeys[0]), ['T', 'T2']);
  assert.equal(storage.reads.some((path) => path.endsWith('-11.json.gz')), false);
});

test('applies the monotonic deadline across shard reads', async (t) => {
  const storage = publishedStorage(t);
  const key = bucket(serviceClass, 8);
  storage.publish(publishedManifest(), 'elapsed_budget', {
    [key]: { connections: [connection('T', 'A', 'Z', 8 * hour + 30, 8 * hour + 60)] },
  });
  let elapsed = 0;
  storage.onRead((path) => { if (path.endsWith(`${key}.json.gz`)) elapsed = 20; });
  const result = await routeTransitSnapshot(await loadActiveSnapshot(), query({ limits: { wallTimeMs: 20 } }),
    { clock: () => elapsed });
  assert.deepEqual(result, { status: 'budget-exceeded', budget: 'timeout',
    diagnostics: { connectionBuckets: 1, connectionShards: 1, transferShards: 0 } });
});

test('returns on timeout even while a shard read is pending', async (t) => {
  const storage = publishedStorage(t);
  const key = bucket(serviceClass, 8);
  storage.publish(publishedManifest(), 'stalled_shard', {
    [key]: { connections: [connection('T', 'A', 'Z', 8 * hour + 30, 8 * hour + 60)] },
  });
  let release: () => void = () => {};
  const stalled = new Promise<void>((resolve) => { release = resolve; });
  storage.onRead((path) => path.endsWith(`${key}.json.gz`) ? stalled : undefined);
  try {
    const result = await routeTransitSnapshot(await loadActiveSnapshot(), query({ limits: { wallTimeMs: 50 } }));
    assert.equal(result.status, 'budget-exceeded');
    assert.equal(result.status === 'budget-exceeded' && result.budget, 'timeout');
  } finally {
    release();
  }
});
