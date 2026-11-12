import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs, { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { gzipSync } from 'node:zlib';
import type { TransitConnection } from './contracts.ts';
import { SnapshotCache } from './snapshot-cache.ts';
import * as snapshotSource from './snapshot-source.ts';
import {
  clearTransitSnapshotCacheForTests,
  loadActiveSnapshot,
  loadManifest,
  loadSnapshotPointer,
  loadSnapshotShard,
  streamSnapshotConnections,
} from './snapshot-source.ts';
import { manifestFixture } from './test-fixtures.ts';

const contentPath = 'content-links.json.gz';
const stopPath = manifestFixture.indexes.stopGrid['4100_2900'];
const connectionPath = Object.values(manifestFixture.indexes.connectionBuckets)[0];
const mibibyte = 1024 ** 2;
const gibibyte = 1024 ** 3;

type FileFixture = { bytes: number; sha256: string; uncompressedBytes?: number; uncompressedSha256?: string };
type ManifestFixture = Omit<typeof manifestFixture, 'files'> & { files: Record<string, FileFixture> };
type StopShard = { cell: string; stops: { name: string }[] };

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function setupStorage(t: TestContext, useLocal = true): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'transit-snapshot-'));
  const env: NodeJS.Dict<string> = process.env;
  const previousNodeEnv = env.NODE_ENV;
  const previousStorage = process.env.TRANSIT_DATA_STORAGE_PATH;
  const previousBaseUrl = process.env.TRANSIT_DATA_BASE_URL;
  env.NODE_ENV = 'test';
  if (useLocal) process.env.TRANSIT_DATA_STORAGE_PATH = root;
  else delete process.env.TRANSIT_DATA_STORAGE_PATH;
  delete process.env.TRANSIT_DATA_BASE_URL;
  clearTransitSnapshotCacheForTests();
  t.after(async () => {
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
    if (previousStorage === undefined) delete process.env.TRANSIT_DATA_STORAGE_PATH;
    else process.env.TRANSIT_DATA_STORAGE_PATH = previousStorage;
    if (previousBaseUrl === undefined) delete process.env.TRANSIT_DATA_BASE_URL;
    else process.env.TRANSIT_DATA_BASE_URL = previousBaseUrl;
    clearTransitSnapshotCacheForTests();
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function stageVersion(root: string, version: string, options: {
  contentBytes?: Buffer;
  fileBytes?: Partial<Record<string, Buffer>>;
  updateManifest?: (manifest: ManifestFixture) => void;
} = {}) {
  const directory = join(root, 'versions', version);
  const manifest: ManifestFixture = { ...structuredClone(manifestFixture), version, files: {} };
  for (const path of Object.keys(manifestFixture.files)) {
    const payload = path === stopPath
      ? { cell: '4100_2900', stops: [{ stopId: '0', stopCode: null, name: `Durak ${version}`, latitude: 41, longitude: 29 }] }
      : { links: {}, schemaVersion: 1 };
    const bytes = options.fileBytes?.[path]
      ?? (path === contentPath && options.contentBytes ? options.contentBytes : gzipSync(JSON.stringify(payload)));
    const filename = join(directory, path);
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, bytes);
    manifest.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  options.updateManifest?.(manifest);
  // The PHP writer preserves zero fractions. Parsing and reserializing changes these bytes.
  const manifestBytes = JSON.stringify(manifest).replace('"minLatitude":41,', '"minLatitude":41.0,');
  await writeFile(join(directory, 'manifest.json'), manifestBytes);
  return { version, manifestSha256: sha256(manifestBytes) };
}

async function writePointer(root: string, name: 'current' | 'previous', pointer: { version: string; manifestSha256: string }) {
  await writeFile(join(root, `${name}.json`), JSON.stringify(pointer));
}

async function collectConnections(snapshot: Awaited<ReturnType<typeof loadActiveSnapshot>>, path = connectionPath) {
  const records: unknown[] = [];
  for await (const record of streamSnapshotConnections(snapshot, path)) records.push(record);
  return records;
}

test('loads the exact published manifest bytes and a legacy gzip inventory', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1');
  await writePointer(root, 'current', pointer);

  assert.deepEqual(await loadSnapshotPointer('current'), pointer);
  assert.equal((await loadManifest(pointer)).version, 'current_v1');
  const snapshot = await loadActiveSnapshot();
  assert.deepEqual(snapshot.pointer, pointer);
  assert.equal(snapshot.version, 'current_v1');
  assert.equal(snapshot.usedFallback, false);
  assert.deepEqual(await loadSnapshotShard(snapshot, contentPath), { links: {}, schemaVersion: 1 });
});

test('loads a legacy connection shard slightly larger than 64 MiB when expanded', async (t) => {
  const root = await setupStorage(t);
  const payload = Buffer.concat([Buffer.from('{"connections":[]}'), Buffer.alloc(65 * mibibyte, 0x20)]);
  const pointer = await stageVersion(root, 'current_v1', {
    fileBytes: { [connectionPath]: gzipSync(payload) },
  });
  await writePointer(root, 'current', pointer);

  assert.deepEqual(await collectConnections(await loadActiveSnapshot()), []);
});

test('requires connection shards to use the streaming reader', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));

  await assert.rejects(loadSnapshotShard(await loadActiveSnapshot(), connectionPath), {
    code: 'CONNECTION_STREAM_REQUIRED',
  });
});

test('streams connection records split across inflate chunks without treating escaped JSON as structure', async (t) => {
  const root = await setupStorage(t);
  const records = [
    { id: 'first', headsign: `${'x'.repeat(20_000)}\\"{Merkez},[A]` },
    { id: 'second', headsign: 'Havalimanı' },
  ];
  const pointer = await stageVersion(root, 'current_v1', {
    fileBytes: { [connectionPath]: gzipSync(JSON.stringify({ connections: records })) },
  });
  await writePointer(root, 'current', pointer);

  assert.deepEqual(await collectConnections(await loadActiveSnapshot()), records);
});

test('connection streaming fails closed for malformed envelopes, hash mismatches, and aborted reads', async (t) => {
  const root = await setupStorage(t);
  const malformed = await stageVersion(root, 'malformed_v1', {
    fileBytes: { [connectionPath]: gzipSync('{"connections":{}}') },
  });
  await writePointer(root, 'current', malformed);
  await assert.rejects(collectConnections(await loadActiveSnapshot()), { code: 'INVALID_SHARD' });

  const mismatched = await stageVersion(root, 'mismatched_v1', {
    updateManifest: (manifest) => { manifest.files[connectionPath].sha256 = '0'.repeat(64); },
  });
  await writePointer(root, 'current', mismatched);
  clearTransitSnapshotCacheForTests();
  await assert.rejects(collectConnections(await loadActiveSnapshot()), { code: 'SHARD_HASH' });

  const valid = await stageVersion(root, 'aborted_v1');
  await writePointer(root, 'current', valid);
  clearTransitSnapshotCacheForTests();
  const abort = new AbortController();
  abort.abort();
  const snapshot = await loadActiveSnapshot();
  const consume = async () => {
    for await (const _record of streamSnapshotConnections(snapshot, connectionPath, { signal: abort.signal })) {
      void _record;
      assert.fail('an aborted stream must not yield records');
    }
  };
  await assert.rejects(consume(), { code: 'READ_FAILED' });
});

test('can preflight only immutable connection bytes before the router performs the single semantic stream', async (t) => {
  const root = await setupStorage(t);
  const current = await stageVersion(root, 'current_v1', {
    fileBytes: { [connectionPath]: gzipSync('{"connections":{}}') },
  });
  await writePointer(root, 'current', current);
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));

  const snapshot = await snapshotSource.loadActiveSnapshotWithPreflight(() => [connectionPath], {
    connectionPreflight: 'compressed',
  });

  assert.equal(snapshot.version, 'current_v1');
  await assert.rejects(collectConnections(snapshot), { code: 'INVALID_SHARD' });
});

test('fails closed when a local snapshot root is configured in production', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1');
  await writePointer(root, 'current', pointer);
  Object.assign(process.env, {
    NODE_ENV: 'production',
    TRANSIT_DATA_BASE_URL: 'https://snapshot.example.test/',
  });
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('production must reject the conflicting configuration'));

  await assert.rejects(loadActiveSnapshot(), {
    code: 'INVALID_STORAGE_CONFIGURATION', message: 'Transit snapshot storage is misconfigured',
  });
  assert.equal(fetch.mock.callCount(), 0);
});

test('uses and logs a validated previous version when current is corrupt', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  await writeFile(join(root, 'current.json'), '{malformed');
  const warn = t.mock.method(console, 'warn', () => {});

  const snapshot = await loadActiveSnapshot();
  assert.equal(snapshot.version, 'previous_v1');
  assert.equal(snapshot.usedFallback, true);
  assert.deepEqual(warn.mock.calls.map(({ arguments: args }) => args), [[{
    event: 'transit_snapshot_fallback', version: 'previous_v1', reason: 'INVALID_POINTER',
  }]]);
});

test('uses previous when the current pointer is missing', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  t.mock.method(console, 'warn', () => {});

  assert.equal((await loadActiveSnapshot()).version, 'previous_v1');
});

test('fails with a sanitized error when both pointer targets are unavailable', async (t) => {
  await setupStorage(t);
  await assert.rejects(loadActiveSnapshot(), { code: 'DATA_UNAVAILABLE', message: 'Transit snapshot data is unavailable' });
});

test('rejects a manifest whose exact bytes do not match its pointer', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1');
  await assert.rejects(loadManifest({ ...pointer, manifestSha256: '0'.repeat(64) }), { code: 'MANIFEST_HASH' });
});

test('rejects a digest-valid manifest that claims a different version', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1', {
    updateManifest: (manifest) => { manifest.version = 'other_v1'; },
  });
  await assert.rejects(loadManifest(pointer), { code: 'INVALID_MANIFEST' });
});

test('rejects a matching-size shard with the wrong compressed hash', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1', {
    updateManifest: (manifest) => { manifest.files[contentPath].sha256 = '0'.repeat(64); },
  });
  await writePointer(root, 'current', pointer);
  await assert.rejects(loadActiveSnapshot(), { code: 'DATA_UNAVAILABLE' });
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  const warn = t.mock.method(console, 'warn', () => {});

  assert.equal((await loadActiveSnapshot()).version, 'previous_v1');
  assert.deepEqual(warn.mock.calls[0].arguments[0], {
    event: 'transit_snapshot_fallback', version: 'previous_v1', reason: 'SHARD_HASH',
  });
});

const contentJson = '{"links":{},"schemaVersion":1}';

test('accepts a shard with matching declared expanded bytes and digest', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1', {
    contentBytes: gzipSync(contentJson),
    updateManifest: (manifest) => {
      manifest.files[contentPath].uncompressedBytes = Buffer.byteLength(contentJson);
      manifest.files[contentPath].uncompressedSha256 = sha256(contentJson);
    },
  });
  await writePointer(root, 'current', pointer);
  assert.deepEqual(await loadSnapshotShard(await loadActiveSnapshot(), contentPath), { links: {}, schemaVersion: 1 });
});

for (const [caseName, options, reason] of [
  ['uncompressed hash mismatch', {
    contentBytes: gzipSync(contentJson),
    updateManifest: (manifest: ManifestFixture) => {
      manifest.files[contentPath].uncompressedBytes = Buffer.byteLength(contentJson);
      manifest.files[contentPath].uncompressedSha256 = '0'.repeat(64);
    },
  }, 'SHARD_HASH'],
  ['uncompressed length mismatch', {
    contentBytes: gzipSync(contentJson),
    updateManifest: (manifest: ManifestFixture) => {
      manifest.files[contentPath].uncompressedBytes = Buffer.byteLength(contentJson) + 1;
      manifest.files[contentPath].uncompressedSha256 = sha256(contentJson);
    },
  }, 'SIZE_LIMIT'],
  ['compressed declaration smaller than the file', {
    updateManifest: (manifest: ManifestFixture) => { manifest.files[contentPath].bytes = 1; },
  }, 'SIZE_LIMIT'],
  ['expanded declaration smaller than the payload', {
    contentBytes: gzipSync(contentJson),
    updateManifest: (manifest: ManifestFixture) => {
      manifest.files[contentPath].uncompressedBytes = 1;
      manifest.files[contentPath].uncompressedSha256 = sha256(contentJson);
    },
  }, 'SIZE_LIMIT'],
  ['gzip bomb without an expanded declaration', {
    contentBytes: gzipSync(Buffer.alloc(72 * 1024 ** 2, 0x20)),
  }, 'SIZE_LIMIT'],
  ['trailing zero bytes after gzip', {
    contentBytes: Buffer.concat([gzipSync(contentJson), Buffer.alloc(2)]),
  }, 'INVALID_GZIP'],
  ['a second empty gzip member', {
    contentBytes: Buffer.concat([gzipSync(contentJson), gzipSync('')]),
  }, 'INVALID_GZIP'],
  ['invalid JSON with matching compressed metadata', {
    contentBytes: gzipSync('{malformed'),
  }, 'INVALID_SHARD'],
  ['a malformed required content-link shard', {
    contentBytes: gzipSync('{"links":[],"schemaVersion":1}'),
  }, 'INVALID_SHARD'],
] as const) {
  test(`falls back for ${caseName}`, async (t) => {
    const root = await setupStorage(t);
    await writePointer(root, 'current', await stageVersion(root, 'current_v1', options));
    await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
    const warn = t.mock.method(console, 'warn', () => {});

    const snapshot = await loadActiveSnapshot();
    assert.equal(snapshot.version, 'previous_v1');
    assert.equal(snapshot.usedFallback, true);
    assert.deepEqual(warn.mock.calls[0].arguments[0], {
      event: 'transit_snapshot_fallback', version: 'previous_v1', reason,
    });
  });
}

test('rejects oversized and incomplete declarations before opening a shard', async (t) => {
  const root = await setupStorage(t);
  for (const [index, overrides] of [
    { bytes: gibibyte },
    { uncompressedBytes: gibibyte, uncompressedSha256: '0'.repeat(64) },
    { uncompressedBytes: 15 },
  ].entries()) {
    const pointer = await stageVersion(root, `current_v${index}`, {
      updateManifest: (manifest) => { Object.assign(manifest.files[stopPath], overrides); },
    });
    await assert.rejects(loadManifest(pointer), { code: 'INVALID_MANIFEST' });
  }
});

test('rejects traversal in the manifest inventory', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1', {
    updateManifest: (manifest) => { manifest.files['stops-grid/../escape.json.gz'] = manifest.files[stopPath]; },
  });
  await assert.rejects(loadManifest(pointer), { code: 'INVALID_MANIFEST' });
});

test('rejects unsafe or undeclared shard requests even if the file exists', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  await writeFile(join(root, 'versions/current_v1/unlisted.json.gz'), gzipSync('{}'));
  const snapshot = await loadActiveSnapshot();
  for (const path of [
    'unlisted.json.gz', `/${contentPath}`, `./${contentPath}`, `../${contentPath}`,
    `foo\\${contentPath}`, `foo/%2e%2e/${contentPath}`, `${contentPath}?x=1`, `${contentPath}#x`,
  ]) {
    await assert.rejects(loadSnapshotShard(snapshot, path), { code: 'UNDECLARED_SHARD' }, path);
  }
});

test('rejects local shard directories linked outside the version', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1');
  await writePointer(root, 'current', pointer);
  const shardDir = join(root, 'versions', pointer.version, dirname(stopPath));
  const outsideVersion = join(root, 'untrusted-symlink-target');
  const original = await readFile(join(root, 'versions', pointer.version, stopPath));
  await mkdir(join(outsideVersion, dirname(stopPath)), { recursive: true });
  await writeFile(join(outsideVersion, stopPath), original);
  await rm(shardDir, { recursive: true });
  try {
    await symlink(join(outsideVersion, dirname(stopPath)), shardDir, 'junction');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EPERM')) throw error;
    t.skip('This environment does not permit creating junctions');
    return;
  }

  const snapshot = await loadActiveSnapshot();
  await assert.rejects(loadSnapshotShard(snapshot, stopPath), { code: 'READ_FAILED' });
});

test('rejects a same-size shard substituted after validating its parent path', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1');
  await writePointer(root, 'current', pointer);
  const snapshot = await loadActiveSnapshot();
  const filename = await fs.realpath(join(root, 'versions', pointer.version, stopPath));
  const shardDirectory = dirname(filename);
  const substitute = join(root, 'replacement-directory');
  await mkdir(substitute);
  await writeFile(join(substitute, stopPath.split('/').at(-1)!), await readFile(filename));

  const originalOpen = fs.open;
  let readCalls: (() => number) | undefined;
  const open = t.mock.method(fs, 'open', async (...args: Parameters<typeof originalOpen>) => {
    if (args[0] !== filename) return originalOpen(...args);
    await rename(shardDirectory, join(root, 'original-directory'));
    await rename(substitute, shardDirectory);
    const handle = await originalOpen(...args);
    const read = t.mock.method(handle, 'read');
    readCalls = () => read.mock.callCount();
    return handle;
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(loadSnapshotShard(snapshot, stopPath), { code: 'READ_FAILED' });
    assert.equal(readCalls?.(), 0);
  } finally {
    open.mock.restore();
    syncBuiltinESMExports();
  }
});

for (const [description, makeLinks] of [
  ['excessive JSON nesting', () => '"stop":' + '['.repeat(80) + '0' + ']'.repeat(80)],
  ['too many JSON containers', () => '"stop":[' + '{},'.repeat(600_000) + '0]'],
  ['too many flat JSON array entries', () => '"stop":[' + '0,'.repeat(3_100_000) + '0]'],
  ['an oversized JSON string', () => '"stop":"' + 'x'.repeat(70 * 1024) + '"'],
] as const) {
  test(`rejects ${description} before JSON.parse`, async (t) => {
    const root = await setupStorage(t);
    const payload = `{"links":{${makeLinks()}},"schemaVersion":1}`;
    await writePointer(root, 'current', await stageVersion(root, 'current_v1', { contentBytes: gzipSync(payload) }));
    await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
    const warn = t.mock.method(console, 'warn', () => {});
    const parse = t.mock.method(JSON, 'parse');

    assert.equal((await loadActiveSnapshot()).version, 'previous_v1');
    assert.equal(parse.mock.calls.some(({ arguments: args }) => args[0] === payload), false);
    assert.deepEqual(warn.mock.calls[0].arguments[0], {
      event: 'transit_snapshot_fallback', version: 'previous_v1', reason: 'JSON_COMPLEXITY',
    });
  });
}

test('loads a producer-shaped link map with escaped quotes, backslashes and brackets in titles', async (t) => {
  const root = await setupStorage(t);
  const title = 'İstanbul ["Durak"] \\ {Meydan}\n';
  const payload = { links: Object.fromEntries(Array.from({ length: 2_000 }, (_, index) => [
    `D${index}`, { canonicalUrl: `/durak/${index}`, title },
  ])), schemaVersion: 1 };
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', {
    contentBytes: gzipSync(JSON.stringify(payload)),
  }));

  const snapshot = await loadActiveSnapshot();
  assert.deepEqual(await loadSnapshotShard(snapshot, contentPath), payload);
});

test('loads 70,000 producer-layout connection records in one hour bucket', async (t) => {
  const root = await setupStorage(t);
  const [bucket, path] = Object.entries(manifestFixture.indexes.connectionBuckets)[0];
  const record: TransitConnection = {
    arrival: 90_720,
    arrivalStopSequence: 2,
    departure: 90_600,
    directionId: '0',
    dropOffType: 0,
    fromStopId: '0',
    headsign: 'İstanbul',
    patternId: Object.keys(manifestFixture.indexes.patterns)[0],
    pickupType: 0,
    routeId: '0',
    serviceClass: bucket.slice(0, 64),
    serviceId: '0',
    shapeId: Object.keys(manifestFixture.indexes.shapes)[0],
    stopSequence: 1,
    toStopId: '1',
    tripId: 'sample-trip',
  };
  const count = 70_000;
  const recordJson = JSON.stringify(record);
  const bytes = gzipSync(`{"connections":[${`${recordJson},`.repeat(count - 1)}${recordJson}]}`);
  const pointer = await stageVersion(root, 'current_v1', {
    updateManifest: (manifest) => {
      manifest.counts.connections = count;
      manifest.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
    },
  });
  await writeFile(join(root, 'versions', pointer.version, path), bytes);
  await writePointer(root, 'current', pointer);

  const snapshot = await loadActiveSnapshot();
  const connections = await collectConnections(snapshot, path) as TransitConnection[];
  assert.equal(connections.length, count);
  assert.deepEqual(connections.at(-1), record);
});

test('keeps a request on its captured version when the current pointer switches', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  const first = await loadActiveSnapshot();
  await writePointer(root, 'current', await stageVersion(root, 'current_v2'));
  const second = await loadActiveSnapshot();

  assert.equal((await loadSnapshotShard<StopShard>(second, stopPath)).stops[0].name, 'Durak current_v2');
  assert.equal((await loadSnapshotShard<StopShard>(first, stopPath)).stops[0].name, 'Durak current_v1');
  const third = await loadSnapshotShard<StopShard>(second, stopPath);
  third.stops[0].name = 'Changed by caller';
  assert.equal((await loadSnapshotShard<StopShard>(second, stopPath)).stops[0].name, 'Durak current_v2');
});

test('does not share shards between storage roots that reuse a version name', async (t) => {
  const root = await setupStorage(t);
  const pointer = await stageVersion(root, 'current_v1');
  await writePointer(root, 'current', pointer);
  const first = await loadActiveSnapshot();

  const secondRoot = join(root, 'other-storage');
  const newBytes = gzipSync(JSON.stringify({ cell: '4100_2900', stops: [{ name: 'Durak from another storage' }] }));
  const secondPointer = await stageVersion(secondRoot, 'current_v1', {
    updateManifest: (manifest) => { manifest.files[stopPath] = { bytes: newBytes.length, sha256: sha256(newBytes) }; },
  });
  await writeFile(join(secondRoot, 'versions', pointer.version, stopPath), newBytes);
  await writePointer(secondRoot, 'current', secondPointer);
  process.env.TRANSIT_DATA_STORAGE_PATH = secondRoot;

  const second = await loadActiveSnapshot();
  assert.equal((await loadSnapshotShard<StopShard>(first, stopPath)).stops[0].name, 'Durak current_v1');
  assert.equal((await loadSnapshotShard<StopShard>(second, stopPath)).stops[0].name, 'Durak from another storage');
});

test('falls back when the required initial shard is missing', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  await rm(join(root, 'versions/current_v1', contentPath));
  t.mock.method(console, 'warn', () => {});

  const snapshot = await loadActiveSnapshot();
  assert.equal(snapshot.version, 'previous_v1');
  assert.equal((await loadSnapshotShard<StopShard>(snapshot, stopPath)).stops[0].name, 'Durak previous_v1');
});

test('selects and validates the required startup shards again against the previous manifest', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  await rm(join(root, 'versions/current_v1', stopPath));
  await rm(join(root, 'versions/previous_v1', stopPath));
  const warn = t.mock.method(console, 'warn', () => {});
  const versions: string[] = [];
  const snapshot = await snapshotSource.loadActiveSnapshotWithPreflight((manifest) => {
    versions.push(manifest.version);
    return [manifest.version === 'current_v1' ? manifest.indexes.stopGrid['4100_2900'] : manifest.indexes.routes['0']];
  });

  assert.deepEqual(versions, ['current_v1', 'previous_v1']);
  assert.equal(snapshot.version, 'previous_v1');
  assert.deepEqual(warn.mock.calls[0].arguments[0], {
    event: 'transit_snapshot_fallback', version: 'previous_v1', reason: 'READ_FAILED',
  });
});

test('propagates an application error thrown by the startup selector without trying previous', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  const applicationError = new snapshotSource.TransitSnapshotError('READ_FAILED');
  const versions: string[] = [];
  await assert.rejects(snapshotSource.loadActiveSnapshotWithPreflight((manifest) => {
    versions.push(manifest.version);
    throw applicationError;
  }), (error) => error === applicationError);
  assert.deepEqual(versions, ['current_v1']);
});

test('keeps later lazy shard errors on the already pinned snapshot', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  await rm(join(root, 'versions/current_v1', stopPath));
  const warn = t.mock.method(console, 'warn', () => {});

  const snapshot = await loadActiveSnapshot();
  await assert.rejects(loadSnapshotShard(snapshot, stopPath), { code: 'READ_FAILED' });
  assert.equal(snapshot.version, 'current_v1');
  assert.equal(warn.mock.callCount(), 0);
});

test('reads production HTTP pointers fresh and permits CDN caching of versioned assets', async (t) => {
  const root = await setupStorage(t, false);
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1'));
  Object.assign(process.env, {
    NODE_ENV: 'production',
    TRANSIT_DATA_BASE_URL: 'https://snapshot.example.test/feeds/transit',
  });
  const requests: [string, RequestCache | undefined, string | null][] = [];
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async (input: URL | string, init: RequestInit) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    requests.push([url.href, init.cache, headers.get('cache-control')]);
    assert.equal(headers.get('accept-encoding'), 'identity');
    const relative = url.pathname.slice('/feeds/transit/'.length);
    if (relative === 'current.json') return new Response(null, { status: 404 });
    return new Response(await readFile(join(root, relative)));
  });

  const snapshot = await loadActiveSnapshot();
  assert.equal(snapshot.version, 'previous_v1');
  assert.deepEqual(await loadSnapshotShard(snapshot, contentPath), { links: {}, schemaVersion: 1 });
  assert.deepEqual(requests, [
    ['https://snapshot.example.test/feeds/transit/current.json', 'no-store', 'no-cache'],
    ['https://snapshot.example.test/feeds/transit/previous.json', 'no-store', 'no-cache'],
    ['https://snapshot.example.test/feeds/transit/versions/previous_v1/manifest.json', 'default', 'max-age=31536000'],
    ['https://snapshot.example.test/feeds/transit/versions/previous_v1/content-links.json.gz', 'default', 'max-age=31536000'],
  ]);
});

test('reuses immutable manifest bytes while reading the production pointer fresh', async (t) => {
  const root = await setupStorage(t, false);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  Object.assign(process.env, {
    NODE_ENV: 'production',
    TRANSIT_DATA_BASE_URL: 'https://snapshot.example.test/feeds/transit',
  });
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: URL | string) => {
    const url = new URL(input);
    requests.push(url.href);
    const relative = url.pathname.slice('/feeds/transit/'.length);
    return new Response(await readFile(join(root, relative)));
  });

  assert.equal((await loadActiveSnapshot()).version, 'current_v1');
  assert.equal((await loadActiveSnapshot()).version, 'current_v1');
  assert.equal(requests.filter((url) => url.endsWith('/current.json')).length, 2);
  assert.equal(requests.filter((url) => url.endsWith('/manifest.json')).length, 1);
});

test('cancels an HTTP shard stream as soon as it exceeds the declared size', async (t) => {
  const root = await setupStorage(t, false);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', {
    updateManifest: (manifest) => { manifest.files[stopPath].bytes = 1; },
  }));
  process.env.TRANSIT_DATA_BASE_URL = 'https://snapshot.example.test/';
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async (input: URL | string) => {
    const relative = new URL(input).pathname.slice(1);
    if (!relative.endsWith(stopPath)) return new Response(await readFile(join(root, relative)));
    return new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(2)); },
      cancel() { cancelled = true; },
    }));
  });

  const snapshot = await loadActiveSnapshot();
  await assert.rejects(loadSnapshotShard(snapshot, stopPath), { code: 'SIZE_LIMIT' });
  assert.equal(cancelled, true);
});

test('evicts the least recently used entry at the count limit', () => {
  const cache = new SnapshotCache<string>(2, 100);
  cache.set('a', 'first', 10);
  cache.set('b', 'second', 10);
  assert.equal(cache.get('a'), 'first');
  cache.set('c', 'third', 10);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 'first');
  assert.equal(cache.get('c'), 'third');
});

test('tracks bytes when replacing, evicting, clearing, and skipping oversized entries', () => {
  const cache = new SnapshotCache<string>(10, 12);
  cache.set('a', 'large', 8);
  cache.set('a', 'small', 3);
  cache.set('b', 'second', 9);
  assert.equal(cache.get('b'), 'second');
  assert.equal(cache.get('a'), 'small');
  cache.set('c', 'third', 8);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 'small');
  assert.equal(cache.get('c'), 'third');
  cache.set('large', 'too large', 13);
  assert.equal(cache.get('large'), undefined);
  assert.equal(cache.get('a'), 'small');
  cache.clear();
  cache.set('d', 'full capacity', 12);
  assert.equal(cache.get('c'), undefined);
  assert.equal(cache.get('d'), 'full capacity');
});
