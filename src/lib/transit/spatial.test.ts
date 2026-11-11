import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { gzipSync } from 'node:zlib';
import { parseManifest, type TransitManifest, type TransitStop, type TransitTransfer } from './contracts.ts';
import { loadActiveSnapshot } from './snapshot-source.ts';
import { estimateWalk, findNearbyStops, getNearbyStopGridCells, getStopGridCell, loadTransferCandidates } from './spatial.ts';
import { manifestFixture } from './test-fixtures.ts';

function stop(stopId: string, latitude: number, longitude: number): TransitStop {
  return { stopId, name: `Durak ${stopId}`, stopCode: null, latitude, longitude };
}

test('matches producer grid boundaries for positive, negative, and floating coordinates', () => {
  assert.equal(getStopGridCell([41.02, 29]), '4102_2900');
  assert.equal(getStopGridCell([41.0199999, 28.9999999]), '4101_2899');
  assert.equal(getStopGridCell([0.29, -0.07]), '29_-7');
  assert.equal(getStopGridCell([-0.001, -0.001]), '-1_-1');
  assert.equal(getStopGridCell([NaN, 29]), null);
});

test('uses only the nine neighboring grid cells in stable order', () => {
  const point: [number, number] = [41.0099, 29.0099];
  assert.deepEqual(getNearbyStopGridCells(point), [
    '4099_2899', '4099_2900', '4099_2901',
    '4100_2899', '4100_2900', '4100_2901',
    '4101_2899', '4101_2900', '4101_2901',
  ]);
  const grid = {
    '4100_2900': [stop('same', 41.0098, 29.0099)],
    '4101_2901': [stop('adjacent', 41.0101, 29.0101)],
    get '4102_2901'(): TransitStop[] { return assert.fail('grid search read an unrelated cell'); },
  };
  assert.deepEqual(findNearbyStops(point, grid, {}).map(({ stop }) => stop.stopId), ['same', 'adjacent']);
});

test('sorts by Haversine distance with stable stop ID ties and deduplicates IDs', () => {
  const grid = {
    '4100_2900': [
      stop('same-id', 41.006, 29.005),
      stop('b', 41.005, 29.0062),
      stop('a', 41.005, 29.0062),
      stop('same-id', 41.005, 29.0055),
    ],
  };
  const nearby = findNearbyStops([41.005, 29.005], grid, { radiusMeters: 150 });
  assert.deepEqual(nearby.map(({ stop }) => stop.stopId), ['same-id', 'a', 'b']);
  assert.equal(nearby[0].stop.longitude, 29.0055);
  assert.ok(nearby[1].distanceMeters > 100 && nearby[1].distanceMeters < 102);
});

test('filters with an inclusive radius and caps oversized radius or count requests', () => {
  const distanceMeters = 111.19492664455875;
  const point: [number, number] = [0, 0];
  const grid = { '0_0': [stop('on-radius', 0.001, 0), stop('too-far', 0.004, 0)] };
  assert.deepEqual(findNearbyStops(point, grid, { radiusMeters: distanceMeters }).map(({ stop }) => stop.stopId),
    ['on-radius']);
  assert.deepEqual(findNearbyStops(point, grid, { radiusMeters: distanceMeters - 0.001 }), []);
  assert.deepEqual(findNearbyStops(point, grid, { radiusMeters: 10_000 }).map(({ stop }) => stop.stopId),
    ['on-radius']);

  const dense = { '0_0': Array.from('kjihgfedcba', (id) => stop(id, 0, 0)) };
  assert.deepEqual(findNearbyStops(point, dense, { maxCandidates: 2 }).map(({ stop }) => stop.stopId), ['a', 'b']);
  assert.deepEqual(findNearbyStops(point, dense, { maxCandidates: 100 }).map(({ stop }) => stop.stopId),
    Array.from('abcdefgh'));
});

test('fails closed on malformed coordinates and invalid search limits', () => {
  const grid = {
    '4100_2900': [
      stop('valid', 41, 29),
      stop('nonfinite', 41, Infinity),
      stop('out-of-range', -91, 29),
      stop(' ', 41, 29),
    ],
  };
  assert.deepEqual(findNearbyStops([41, 29], grid, {}).map(({ stop }) => stop.stopId), ['valid']);
  assert.deepEqual(findNearbyStops([NaN, 29], grid, {}), []);
  assert.deepEqual(findNearbyStops([41, 181], grid, {}), []);
  for (const options of [{ radiusMeters: 0 }, { radiusMeters: Infinity }, { maxCandidates: -1 }, { maxCandidates: 1.5 }]) {
    assert.deepEqual(findNearbyStops([41, 29], grid, options), []);
  }
});

test('rounds walking up at conservative speeds and supplies separate fixed buffers', () => {
  assert.deepEqual(estimateWalk(56), {
    distanceMeters: 56,
    walkingSeconds: 51,
    boardingBufferSeconds: 30,
    transferBufferSeconds: 60,
    approximate: true,
  });
  assert.equal(estimateWalk(56, 0.8).walkingSeconds, 70);
  assert.equal(estimateWalk(0).walkingSeconds, 0);
  for (const distance of [-1, NaN, Infinity]) {
    assert.throws(() => estimateWalk(distance), RangeError);
  }
  for (const speed of [0, NaN, 1.5]) {
    assert.throws(() => estimateWalk(56, speed), RangeError);
  }
});

const originCell = '4100_2900';
const adjacentCell = '4101_2900';
const unrelatedCell = '4110_2900';
const transferA: TransitTransfer = {
  fromStopId: '0', toStopId: 'B', distanceMeters: 56, seconds: 111,
  evidence: { type: 'source', reference: 'IETT verified pair 0/B' },
};
const transferB: TransitTransfer = {
  fromStopId: '0', toStopId: 'C', distanceMeters: 80, seconds: 135,
  evidence: { type: 'cms', reference: 'Durak geçişi 0/C' },
};
const transferC: TransitTransfer = {
  fromStopId: 'B', toStopId: '0', distanceMeters: 56, seconds: 111,
  evidence: { type: 'manual', reference: 'Documented reverse walk B/0' },
};

function sha256(content: Buffer | string) {
  return createHash('sha256').update(content).digest('hex');
}

async function setupSnapshot(t: TestContext, originPayload: unknown) {
  const root = await mkdtemp(join(tmpdir(), 'transit-transfers-'));
  const env: NodeJS.Dict<string> = process.env;
  const previousNodeEnv = env.NODE_ENV;
  const previousStoragePath = process.env.TRANSIT_DATA_STORAGE_PATH;
  const previousBaseUrl = process.env.TRANSIT_DATA_BASE_URL;
  env.NODE_ENV = 'test';
  process.env.TRANSIT_DATA_STORAGE_PATH = root;
  delete process.env.TRANSIT_DATA_BASE_URL;
  t.after(async () => {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
    if (previousStoragePath === undefined) delete process.env.TRANSIT_DATA_STORAGE_PATH;
    else process.env.TRANSIT_DATA_STORAGE_PATH = previousStoragePath;
    if (previousBaseUrl !== undefined) process.env.TRANSIT_DATA_BASE_URL = previousBaseUrl;
    await rm(root, { recursive: true, force: true });
  });

  const version = 'transfer_fixture';
  const directory = join(root, 'versions', version);
  const indexes: TransitManifest['indexes'] = {
    ...parseManifest(manifestFixture).indexes,
    stops: {}, stopGrid: {}, transfers: {},
  };
  const files: TransitManifest['files'] = { ...manifestFixture.files };
  delete files[manifestFixture.indexes.transfers[originCell]];

  async function writeShard(path: string, payload: unknown) {
    const bytes = gzipSync(JSON.stringify(payload));
    const filename = join(directory, path);
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, bytes);
    files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
  }

  for (const [cell, ids] of [[originCell, ['0', 'B']], [adjacentCell, ['C', 'D']], [unrelatedCell, ['UNRELATED']]] as const) {
    const hash = sha256(cell);
    const stopPath = `stops-grid/${hash}.json.gz`;
    const transferPath = `transfers/${hash}.json.gz`;
    indexes.stopGrid[cell] = stopPath;
    indexes.transfers[cell] = transferPath;
    for (const id of ids) indexes.stops[id] = stopPath;
    files[stopPath] = { bytes: 1, sha256: hash };
    if (cell === unrelatedCell) {
      // Declared and deliberately absent so an accidental read fails the test.
      files[transferPath] = { bytes: 1, sha256: hash };
    } else {
      await writeShard(transferPath, cell === originCell ? originPayload : { cell, transfers: [] });
    }
  }

  await writeShard('content-links.json.gz', { schemaVersion: 1, links: {} });
  const manifest = JSON.stringify({ ...manifestFixture, version, files, indexes });
  await writeFile(join(directory, 'manifest.json'), manifest);
  const pointerPath = join(root, 'current.json');
  await writeFile(pointerPath, JSON.stringify({ version, manifestSha256: sha256(manifest) }));
  const snapshot = await loadActiveSnapshot();
  // A later request might see a different pointer. The helper must keep using this snapshot.
  await writeFile(pointerPath, '{}');
  return snapshot;
}

test('loads pinned transfer shards for requested stop IDs and preserves evidence in stable order', async (t) => {
  const snapshot = await setupSnapshot(t, {
    cell: originCell, transfers: [transferC, transferB, transferA, transferA],
  });
  assert.deepEqual(await loadTransferCandidates(['B', 'C', '0', '0', 'unknown', '__proto__'], snapshot),
    [transferA, transferB, transferC]);
  assert.deepEqual(await loadTransferCandidates(['0'], snapshot), [transferA, transferB]);
});

test('accepts empty verified shards without synthesizing proximity edges', async (t) => {
  const snapshot = await setupSnapshot(t, { cell: originCell, transfers: [transferA] });
  assert.deepEqual(await loadTransferCandidates(['C', 'D'], snapshot), []);
  assert.deepEqual(await loadTransferCandidates(['unknown'], snapshot), []);
});

test('propagates an unavailable requested shard from the pinned snapshot', async (t) => {
  const snapshot = await setupSnapshot(t, { cell: originCell, transfers: [] });
  await assert.rejects(loadTransferCandidates(['UNRELATED'], snapshot), { code: 'READ_FAILED' });
});

test('rejects malformed transfer payloads and cell labels', async (t) => {
  for (const [name, payload] of [
    ['cell mismatch', { cell: adjacentCell, transfers: [] }],
    ['non-list', { cell: originCell, transfers: {} }],
  ] as const) {
    await t.test(name, async (subtest) => {
      const snapshot = await setupSnapshot(subtest, payload);
      await assert.rejects(loadTransferCandidates(['0'], snapshot), { code: 'INVALID_SHARD' });
    });
  }
});

test('rejects invalid transfer edges even when their origin was not requested', async (t) => {
  for (const [name, transfers] of [
    ['unknown destination', [{ ...transferC, toStopId: 'unknown' }]],
    ['origin belongs to a different cell', [{ ...transferC, fromStopId: 'C' }]],
    ['missing evidence reference', [{ ...transferC, evidence: { type: 'manual', reference: ' ' } }]],
    ['unverified evidence type', [{ ...transferC, evidence: { type: 'proximity', reference: 'nearby' } }]],
    ['non-conservative duration', [{ ...transferC, seconds: 110 }]],
    ['distance beyond producer limit', [{ ...transferC, distanceMeters: 351, seconds: 400 }]],
    ['conflicting directed duplicates', [transferC, { ...transferC, seconds: 120 }]],
  ] as const) {
    await t.test(name, async (subtest) => {
      const snapshot = await setupSnapshot(subtest, { cell: originCell, transfers });
      await assert.rejects(loadTransferCandidates(['0'], snapshot), { code: 'INVALID_SHARD' });
    });
  }
});
