import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { transpileConfig } from 'next/dist/build/next-config-ts/transpile-config.js';
import {
  checkedAt, connectionPath, contentPath, decoyStopPath, destinationStopPath,
  destinationTransferPath, fixtureStorage, originStopPath, shapePath,
} from '../test-storage.ts';
import { createTransitRouteHandler } from './handler.ts';
import { dynamic, POST, runtime } from './route.ts';

const params: Record<string, unknown> = {
  originLat: 41.000987, originLng: 28.999913,
  destinationLat: 41.021234, destinationLng: 29.021234,
  departureAt: '2026-11-10T07:00:00Z', preference: 'fastest',
};
const now = () => new Date(checkedAt);
const routeRequest = (
  edit?: (body: Record<string, unknown>) => void,
  options: { method?: string; contentType?: string | null; rawBody?: string; contentLength?: string } = {},
) => {
  const body = { ...params };
  edit?.(body);
  const method = options.method ?? 'POST';
  const headers = new Headers();
  if (options.contentType !== null) headers.set('Content-Type', options.contentType ?? 'application/json');
  if (options.contentLength !== undefined) headers.set('Content-Length', options.contentLength);
  return new Request('https://hizliulasim.com/api/transit/route', {
    method,
    headers,
    ...(method !== 'GET' && method !== 'HEAD' && { body: options.rawBody ?? JSON.stringify(body) }),
  });
};
const routeHandler = (options: Parameters<typeof createTransitRouteHandler>[0] = {}) => {
  const logs: unknown[] = [];
  return { get: createTransitRouteHandler({ now, log: (entry) => logs.push(entry), ...options }), logs };
};

async function expectError(response: Response, status: number, code: string) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.deepEqual(body, { error: { code, message: body.error.message } });
  assert.match(body.error.message, /[çğıöşüÇĞİÖŞÜ]/u);
  assert.doesNotMatch(JSON.stringify(body), /private-storage|internal-assets|versions\/|\.json\.gz|41\.000987|originLat|[a-f0-9]{64}/u);
}

test('the public route is dynamic and writes one coordinate-free JSON line with the default logger', async (t) => {
  assert.equal(runtime, 'nodejs');
  assert.equal(dynamic, 'force-dynamic');
  const lines: string[] = [];
  const writer = t.mock.method(process.stdout, 'write', (line: string) => {
    lines.push(line);
    return true;
  });
  const response = await POST(routeRequest((body) => delete body.preference));
  writer.mock.restore();
  await expectError(response, 400, 'INVALID_REQUEST');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^[^\r\n]+\n$/u);
  assert.doesNotMatch(lines[0], /41\.000987|28\.999913|originLat|destinationLng|departureAt/u);
  const { elapsedMs, ...entry } = JSON.parse(lines[0]);
  assert.ok(Number.isInteger(elapsedMs) && elapsedMs >= 0);
  assert.deepEqual(entry, {
    event: 'transit_route', outcome: 'INVALID_REQUEST', version: null, usedFallback: false,
    connectionShards: 0, transferShards: 0, originCandidates: 0, destinationCandidates: 0,
    alternatives: 0, errorCode: 'INVALID_REQUEST',
  });
});

test('Next development request logging does not need to hide the coordinate-free route endpoint', async () => {
  const nextConfigPath = fileURLToPath(new URL('../../../../../next.config.ts', import.meta.url));
  const { default: config }: { default: NextConfig } = await transpileConfig({ nextConfigPath, dir: dirname(nextConfigPath) });
  const logging = config.logging;
  assert.ok(logging && typeof logging.incomingRequests === 'object' && logging.incomingRequests.ignore);
  const { ignore } = logging.incomingRequests;
  const ignored = (url: string) => ignore.some((pattern) => pattern.test(url));
  for (const url of ['/api/transit/route', '/api/transit/route/', '/api/transit/status']) {
    assert.equal(ignored(url), false, url);
  }
  for (const url of ['/yol-tarifi?o=41,29&d=41.1,29.1', '/yol-tarifi/?o=41,29']) {
    assert.equal(ignored(url), true, url);
  }
});

test('preflights adjacent stop grids and the first connection hour before routing against the selected version', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test', { laterBucket: true });
  const { get, logs } = routeHandler({ clock: () => 5 });
  const response = await get(routeRequest());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { itineraries, metadata, diagnostics } = await response.json();
  assert.deepEqual(metadata, { dataVersion: 'current_test', usedFallback: false });
  assert.equal(itineraries.length, 1);
  assert.deepEqual(itineraries[0].steps.map(({ mode }: { mode: string }) => mode), ['walking', 'bus', 'walking']);
  assert.equal(itineraries[0].steps[1].lineCode, 'T1');
  assert.equal(itineraries[0].steps[1].board.contentLink.title, 'Başlangıç durağı');
  assert.equal(itineraries[0].metadata.serviceDate, '2026-11-10');
  assert.deepEqual(diagnostics, { connectionBuckets: 1, connectionShards: 1, transferShards: 2,
    originCandidates: 1, destinationCandidates: 1 });
  assert.deepEqual(new Set(storage.reads.slice(3, 7)), new Set(
    [originStopPath, destinationStopPath, decoyStopPath, connectionPath(10)].map((path) => `versions/current_test/${path}`),
  ));
  assert.equal(storage.reads.includes(`versions/current_test/${connectionPath(11)}`), false);
  assert.equal(storage.reads.filter((path) => path === `versions/current_test/${connectionPath(10)}`).length, 1);
  assert.deepEqual(logs, [{ event: 'transit_route', outcome: 'ok', elapsedMs: 0, version: 'current_test',
    usedFallback: false, connectionShards: 1, transferShards: 2, originCandidates: 1,
    destinationCandidates: 1, alternatives: 1 }]);
  assert.doesNotMatch(JSON.stringify(logs), /41\.000987|29\.021234|originLat|Başlangıç|hizliulasim|internal-assets/u);
});

test('default route continues after the former wall-clock deadline', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test');
  let monotonicTime = 0;
  storage.readHooks.set(`versions/current_test/${contentPath}`, () => { monotonicTime = 60_000; });
  const { get } = routeHandler({ clock: () => monotonicTime });

  const response = await get(routeRequest());

  assert.equal(response.status, 200);
});

const invalidBodies: [string, (body: Record<string, unknown>) => void][] = [
  ['missing parameter', (body) => delete body.departureAt],
  ['unexpected parameter', (body) => { body.originName = 'private place'; }],
  ['malformed coordinate', (body) => { body.originLng = '0x1d'; }],
  ['coordinate outside İstanbul', (body) => { body.destinationLat = 43; }],
  ['malformed timestamp', (body) => { body.departureAt = '2026-11-10T07:00'; }],
  ['timestamp outside request horizon', (body) => { body.departureAt = '2026-11-17T00:00:00Z'; }],
  ['unsupported preference', (body) => { body.preference = 'walking'; }],
];
for (const [label, edit] of invalidBodies) {
  test(`rejects ${label} before reading storage`, async (t) => {
    const { reads } = fixtureStorage(t);
    const { get, logs } = routeHandler();
    await expectError(await get(routeRequest(edit)), 400, 'INVALID_REQUEST');
    assert.deepEqual(reads, []);
    assert.equal(logs.length, 1);
  });
}

test('rejects a non-POST method, missing JSON content type, malformed JSON and oversized body before storage', async (t) => {
  const { reads } = fixtureStorage(t);
  const { get, logs } = routeHandler();
  const requests = [
    routeRequest(undefined, { method: 'GET' }),
    routeRequest(undefined, { contentType: null }),
    routeRequest(undefined, { rawBody: '{' }),
    routeRequest(undefined, { rawBody: JSON.stringify({ ...params, padding: 'x'.repeat(1024) }) }),
    routeRequest(undefined, { contentLength: '2048' }),
  ];
  for (const request of requests) await expectError(await get(request), 400, 'INVALID_REQUEST');
  assert.deepEqual(reads, []);
  assert.equal(logs.length, requests.length);
});

test('returns no route when a valid endpoint has no nearby stop', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test');
  const { get } = routeHandler();
  await expectError(await get(routeRequest((body) => { body.destinationLat = 41.5; })), 404, 'NO_ROUTE');
  assert.equal(storage.reads.some((path) => path.includes('/transfers/')), false);
  assert.equal(storage.reads.includes('previous.json'), false);
});

test('returns no route for a valid scan with no reachable destination', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test', { noServiceToDestination: true });
  storage.publish('previous', 'previous_test');
  await expectError(await routeHandler().get(routeRequest()), 404, 'NO_ROUTE');
  assert.equal(storage.reads.includes('previous.json'), false);
});

for (const problem of ['missing current pointer', 'corrupt current startup bucket', 'missing current adjacent stop grid']) {
  test(`validates the previous version's own startup paths after ${problem}`, async (t) => {
    const storage = fixtureStorage(t);
    const warn = t.mock.method(console, 'warn', () => {});
    const fallbackClass = 'b'.repeat(64);
    storage.publish('previous', 'previous_test', { classId: fallbackClass });
    if (problem !== 'missing current pointer') storage.publish('current', 'current_test');
    if (problem === 'corrupt current startup bucket') {
      storage.files.set(`versions/current_test/${connectionPath(10)}`, Buffer.from('corrupt'));
    }
    if (problem === 'missing current adjacent stop grid') storage.files.delete(`versions/current_test/${decoyStopPath}`);
    const { get, logs } = routeHandler();
    const response = await get(routeRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.metadata, { dataVersion: 'previous_test', usedFallback: true });
    assert.equal(body.itineraries[0].metadata.dataVersion, 'previous_test');
    assert.ok(storage.reads.includes(`versions/previous_test/${connectionPath(10, fallbackClass)}`));
    assert.equal(storage.reads.includes(`versions/previous_test/${connectionPath(10)}`), false);
    assert.equal(logs.length + warn.mock.callCount(), 1);
  });
}

test('returns data unavailable when neither version is usable', async (t) => {
  const storage = fixtureStorage(t);
  storage.files.set('previous.json', Buffer.from('malformed'));
  const { get } = routeHandler();
  await expectError(await get(routeRequest()), 503, 'DATA_UNAVAILABLE');
  assert.deepEqual(storage.reads, ['current.json', 'previous.json']);
});

const malformedShards: [string, string, unknown][] = [
  ['connection', connectionPath(10), { connections: [{ departure: -1 }] }],
  ['stop', decoyStopPath, { cell: '4101_2899', precision: 0.01, stops: [] }],
  ['incomplete stop grid', decoyStopPath, { cell: '4101_2899', precision: 0.01,
    stops: [{ stopId: 'decoy', stopCode: null, name: 'Uzak durak', latitude: 41.015, longitude: 28.991 }] }],
  ['shape', shapePath, { shapes: [] }],
  ['content link', contentPath, { schemaVersion: 1, links: { '0': { title: 'Gizli', canonicalUrl: 'https://private.invalid/' } } }],
];
for (const [label, path, payload] of malformedShards) {
  test(`returns sanitized 503 for a digest-valid malformed ${label} shard on the pinned version`, async (t) => {
    const storage = fixtureStorage(t);
    storage.publish('current', 'current_test', {
      overrides: { [path]: payload },
      editManifest: (manifest) => {
        if (label === 'incomplete stop grid') manifest.indexes.stops.missing = decoyStopPath;
      },
    });
    storage.publish('previous', 'previous_test');
    const { get, logs } = routeHandler();
    await expectError(await get(routeRequest()), 503, 'DATA_UNAVAILABLE');
    assert.equal(storage.reads.includes('previous.json'), false);
    assert.equal(logs.length, 1);
    assert.match(JSON.stringify(logs), /INVALID_SHARD/u);
  });
}

test('returns 504 on a search resource limit without reading a later bucket', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test', { laterBucket: true, noServiceToDestination: true });
  const { get, logs } = routeHandler({ limits: { maxBuckets: 1 } });
  await expectError(await get(routeRequest()), 504, 'ROUTE_TIMEOUT');
  assert.equal(storage.reads.includes(`versions/current_test/${connectionPath(11)}`), false);
  assert.match(JSON.stringify(logs), /buckets/u);
});

test('returns 504 when the pointer read stalls and prevents manifest I/O when it resumes', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test');
  const gate = Promise.withResolvers<void>();
  storage.readHooks.set('current.json', () => gate.promise);
  const { get, logs } = routeHandler({ clock: () => 0, limits: { wallTimeMs: 20 } });
  await expectError(await get(routeRequest()), 504, 'ROUTE_TIMEOUT');
  gate.resolve();
  await setImmediate();
  assert.deepEqual(storage.reads, ['current.json']);
  assert.equal(logs.length, 1);
});

for (const [phase, path] of [
  ['startup preflight', contentPath],
  ['route scan', destinationTransferPath],
  ['itinerary enrichment', shapePath],
]) {
  test(`stops new I/O and returns 504 at the deadline during ${phase}`, async (t) => {
    const storage = fixtureStorage(t);
    storage.publish('current', 'current_test');
    const lateReads: string[] = [];
    let monotonicTime = 0;
    const fetch = globalThis.fetch;
    t.mock.method(globalThis, 'fetch', (url: URL) => {
      if (monotonicTime > 0) lateReads.push(url.pathname);
      return fetch(url);
    });
    storage.readHooks.set(`versions/current_test/${path}`, () => { monotonicTime = 20; });
    const { get, logs } = routeHandler({ clock: () => monotonicTime, limits: { wallTimeMs: 20 } });
    await expectError(await get(routeRequest()), 504, 'ROUTE_TIMEOUT');
    await setImmediate();
    assert.deepEqual(lateReads, []);
    assert.equal(storage.reads.includes('previous.json'), false);
    assert.equal(logs.length, 1);
  });
}
