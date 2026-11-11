import { createHash } from 'node:crypto';
import type { TestContext } from 'node:test';
import { gzipSync } from 'node:zlib';
import { parseManifest, type TransitManifest } from '../../../lib/transit/contracts.ts';
import { clearTransitSnapshotCacheForTests } from '../../../lib/transit/snapshot-source.ts';
import { manifestFixture } from '../../../lib/transit/test-fixtures.ts';

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const originCell = '4100_2900';
const destinationCell = '4102_2902';
const decoyCell = '4101_2899';
const stopPath = (cell: string) => `stops-grid/${sha256(cell)}.json.gz`;
const transferPath = (cell: string) => `transfers/${sha256(cell)}.json.gz`;
const serviceClass = 'a'.repeat(64);
const patternId = 'c'.repeat(64);
const shapeId = 'd'.repeat(64);
const routePath = `routes/${sha256('0')}.json.gz`;
const patternPath = `patterns/${patternId}.json.gz`;
const bucketKey = (hour: number, classId = serviceClass) => `${classId}-${hour}`;
export const connectionPath = (hour: number, classId?: string) => `connections/${bucketKey(hour, classId)}.json.gz`;
export const originStopPath = stopPath(originCell);
export const decoyStopPath = stopPath(decoyCell);
export const destinationStopPath = stopPath(destinationCell);
export const destinationTransferPath = transferPath(destinationCell);
export const shapePath = `shapes/${shapeId}.json.gz`;
export const contentPath = 'content-links.json.gz';
export const checkedAt = '2026-11-09T22:00:00.000Z';

interface PublishOptions {
  classId?: string;
  laterBucket?: boolean;
  noServiceToDestination?: boolean;
  overrides?: Record<string, unknown>;
  editManifest?: (manifest: TransitManifest) => void;
}

function fixture(options: PublishOptions) {
  const classId = options.classId ?? serviceClass;
  const manifest = structuredClone(parseManifest(manifestFixture));
  const connection = {
    departure: 36_300, arrival: 37_200, stopSequence: 1, arrivalStopSequence: 2,
    tripId: 'test-trip', routeId: '0', serviceId: '0', serviceClass: classId, patternId, shapeId,
    directionId: '0', headsign: 'Merkez', fromStopId: '0',
    toStopId: options.noServiceToDestination ? 'decoy' : '1', pickupType: 0, dropOffType: 0,
  };
  const payloads: Record<string, unknown> = {
    [originStopPath]: { cell: originCell, precision: 0.01,
      stops: [{ stopId: '0', stopCode: '100', name: 'Başlangıç durağı', latitude: 41.001, longitude: 29.0001 }] },
    [destinationStopPath]: { cell: destinationCell, precision: 0.01,
      stops: [{ stopId: '1', stopCode: '101', name: 'Hedef durağı', latitude: 41.0211, longitude: 29.0211 }] },
    [decoyStopPath]: { cell: decoyCell, precision: 0.01,
      stops: [{ stopId: 'decoy', stopCode: null, name: 'Uzak durak', latitude: 41.015, longitude: 28.991 }] },
    ...Object.fromEntries([originCell, destinationCell, decoyCell].map((cell) =>
      [transferPath(cell), { cell, transfers: [] }])),
    [routePath]: { routeId: '0', shortName: 'T1', longName: '', routeType: 3, patternIds: [patternId] },
    [patternPath]: { patterns: [{ patternId, routeId: '0', directionId: '0',
      stopIds: ['0', '1'], tripIds: ['test-trip'], shapeIds: [shapeId] }] },
    [shapePath]: { shapes: [{ shapeId, sourceShapeId: null, geometryQuality: 'approximate',
      points: [[41.001, 29.0001], [41.0211, 29.0211]] }] },
    [connectionPath(10, classId)]: { connections: [connection] },
    [contentPath]: { schemaVersion: 1, links: {
      '0': { title: 'Başlangıç durağı', canonicalUrl: 'https://hizliulasim.com/otobus-duraklari/baslangic-100' },
    } },
    ...options.overrides,
  };
  manifest.indexes = {
    ...manifest.indexes,
    stops: { '0': originStopPath, '1': destinationStopPath, decoy: decoyStopPath },
    stopGrid: { [originCell]: originStopPath, [destinationCell]: destinationStopPath, [decoyCell]: decoyStopPath },
    transfers: Object.fromEntries([originCell, destinationCell, decoyCell].map((cell) => [cell, transferPath(cell)])),
    routes: { '0': routePath },
    connectionBuckets: { [bucketKey(10, classId)]: connectionPath(10, classId) },
    calendarRules: { '0': classId },
    serviceClasses: { [classId]: manifest.indexes.serviceClasses[serviceClass] },
  };
  if (options.laterBucket) {
    manifest.indexes.connectionBuckets[bucketKey(11, classId)] = connectionPath(11, classId);
    payloads[connectionPath(11, classId)] = {
      connections: [{ ...connection, tripId: 'later-trip', departure: 39_900, arrival: 40_800 }],
    };
  }
  return { manifest, payloads };
}

export function fixtureStorage(t: TestContext) {
  const env = process.env;
  const { TRANSIT_DATA_BASE_URL, TRANSIT_DATA_STORAGE_PATH } = env;
  env.TRANSIT_DATA_BASE_URL = 'https://private-storage.invalid/internal-assets/';
  delete env.TRANSIT_DATA_STORAGE_PATH;
  clearTransitSnapshotCacheForTests();
  t.after(() => {
    if (TRANSIT_DATA_BASE_URL === undefined) delete env.TRANSIT_DATA_BASE_URL;
    else env.TRANSIT_DATA_BASE_URL = TRANSIT_DATA_BASE_URL;
    if (TRANSIT_DATA_STORAGE_PATH === undefined) delete env.TRANSIT_DATA_STORAGE_PATH;
    else env.TRANSIT_DATA_STORAGE_PATH = TRANSIT_DATA_STORAGE_PATH;
    clearTransitSnapshotCacheForTests();
  });

  const files = new Map<string, Buffer>();
  const reads: string[] = [];
  const readHooks = new Map<string, () => void | Promise<void>>();
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    assertFixtureStorage(url);
    const path = url.pathname.slice('/internal-assets/'.length);
    reads.push(path);
    await readHooks.get(path)?.();
    const data = files.get(path);
    return data ? new Response(new Uint8Array(data)) : new Response(null, { status: 404 });
  });

  function publish(pointer: 'current' | 'previous', version: string, options: PublishOptions = {}) {
    const { manifest, payloads } = fixture(options);
    manifest.version = version;
    manifest.files = {};
    for (const [path, payload] of Object.entries(payloads)) {
      const bytes = gzipSync(JSON.stringify(payload));
      files.set(`versions/${version}/${path}`, bytes);
      manifest.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
    }
    options.editManifest?.(manifest);
    const bytes = Buffer.from(JSON.stringify(manifest));
    files.set(`versions/${version}/manifest.json`, bytes);
    files.set(`${pointer}.json`, Buffer.from(JSON.stringify({ version, manifestSha256: sha256(bytes) })));
  }

  return { files, reads, readHooks, publish };
}

function assertFixtureStorage(url: URL) {
  if (url.origin !== 'https://private-storage.invalid' || !url.pathname.startsWith('/internal-assets/')) {
    throw new Error('Unexpected fetch outside the fixture storage');
  }
}
