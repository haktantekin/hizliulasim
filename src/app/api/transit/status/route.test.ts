import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkedAt, contentPath, fixtureStorage } from '../test-storage.ts';
import { createTransitStatusHandler } from './handler.ts';
import { dynamic, GET, runtime } from './route.ts';

const get = () => createTransitStatusHandler(() => new Date(checkedAt))();

async function check(response: Response, status: number) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.doesNotMatch(JSON.stringify(body), /private-storage|internal-assets|versions\/|[a-f0-9]{64}|https?:\/\//u);
  assert.equal(body.readinessScope, 'manifest');
  assert.equal(body.shardIntegrityChecked, false);
  assert.equal(body.shardValidation, 'on-route-request');
  return body;
}

test('the readiness endpoint is dynamic and Node-only', async (t) => {
  fixtureStorage(t);
  assert.equal(runtime, 'nodejs');
  assert.equal(dynamic, 'force-dynamic');
  assert.equal((await check(await GET(), 503)).ready, false);
});

test('uses validated pointers and manifests and checks the current Istanbul date near midnight', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test');
  storage.publish('previous', 'previous_test');
  storage.files.delete(`versions/current_test/${contentPath}`);
  const body = await check(await get(), 200);
  assert.deepEqual(body, {
    ready: true, status: 'ready', activeVersion: 'current_test', usedFallback: false,
    currentVersion: 'current_test', previousVersion: 'previous_test',
    schemaCompatible: true, serviceDateRange: { start: '2026-11-10', end: '2026-11-10' },
    istanbulDate: '2026-11-10', coversToday: true,
    generatedAt: '2026-11-10T13:00:00Z', checkedAt,
    readinessScope: 'manifest', shardIntegrityChecked: false, shardValidation: 'on-route-request',
  });
  assert.deepEqual(new Set(storage.reads), new Set(['current.json', 'previous.json',
    'versions/current_test/manifest.json', 'versions/previous_test/manifest.json']));
});

test('reports degraded readiness using the validated previous manifest after an incompatible current schema', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'future_schema', { editManifest: (manifest) => Object.assign(manifest, { schemaVersion: 99 }) });
  storage.publish('previous', 'previous_test');
  const body = await check(await get(), 200);
  assert.deepEqual([body.ready, body.status, body.activeVersion, body.usedFallback, body.schemaCompatible,
    body.currentVersion, body.previousVersion], [true, 'degraded', 'previous_test', true, true, 'future_schema', 'previous_test']);
});

test('reports not ready for an incompatible manifest and never exposes an invalid pointer identifier', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'future_schema', { editManifest: (manifest) => Object.assign(manifest, { schemaVersion: 99 }) });
  storage.files.set('previous.json', Buffer.from(JSON.stringify({ version: '../internal-assets', manifestSha256: '0'.repeat(64) })));
  const body = await check(await get(), 503);
  assert.deepEqual([body.ready, body.status, body.activeVersion, body.usedFallback, body.schemaCompatible,
    body.currentVersion, body.previousVersion, body.serviceDateRange, body.coversToday],
  [false, 'unavailable', null, false, false, 'future_schema', null, null, false]);
});

test('validates the manifest digest before reporting readiness', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test');
  const path = 'versions/current_test/manifest.json';
  const manifest = storage.files.get(path)!;
  storage.files.set(path, Buffer.concat([manifest, Buffer.from(' ')]));
  const body = await check(await get(), 503);
  assert.equal(body.schemaCompatible, false);
  assert.equal(body.activeVersion, null);
});

test('reports an otherwise compatible snapshot outside today’s coverage as unavailable', async (t) => {
  const storage = fixtureStorage(t);
  storage.publish('current', 'current_test', { editManifest: (manifest) => {
    manifest.serviceDateRange = { start: '2026-11-08', end: '2026-11-09' };
  } });
  storage.publish('previous', 'previous_test');
  const body = await check(await get(), 503);
  assert.deepEqual([body.ready, body.status, body.activeVersion, body.usedFallback, body.schemaCompatible, body.coversToday],
    [false, 'unavailable', 'current_test', false, true, false]);
});
