import assert from 'node:assert/strict';
import test from 'node:test';

import { parseManifest, parseRouteRequest, parseSnapshotPointer } from './contracts.ts';
import { manifestFixture, snapshotPointerFixture } from './test-fixtures.ts';

const now = new Date('2026-11-10T12:00:00.000Z');

function requestUrl(overrides: Record<string, string | null> = {}): URL {
  const url = new URL('https://hizliulasim.com/api/transit/route');
  const fields = {
    originLat: '41.01',
    originLng: '29.01',
    destinationLat: '41.05',
    destinationLng: '29.04',
    departureAt: '2026-11-10T15:00:00+03:00',
    preference: 'fastest',
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) {
    if (value !== null) url.searchParams.set(name, value);
  }
  return url;
}

test('reads a CMS snapshot pointer with no schema version field', () => {
  assert.deepEqual(parseSnapshotPointer(snapshotPointerFixture), snapshotPointerFixture);
});

test('rejects a pointer without both fields or with extra fields', () => {
  assert.throws(() => parseSnapshotPointer({ version: snapshotPointerFixture.version }));
  assert.throws(() => parseSnapshotPointer({ manifestSha256: snapshotPointerFixture.manifestSha256 }));
  assert.throws(() => parseSnapshotPointer({ ...snapshotPointerFixture, schemaVersion: 1 }));
});

test('rejects unsafe version IDs and malformed manifest hashes in pointers', () => {
  assert.throws(() => parseSnapshotPointer({ ...snapshotPointerFixture, version: '../fixture_v1' }));
  assert.throws(() => parseSnapshotPointer({ ...snapshotPointerFixture, manifestSha256: 'A'.repeat(64) }));
});

test('reads the schema-1 producer indexes, exceptions-only calendars and provenance', () => {
  const manifest = parseManifest(JSON.parse(JSON.stringify(manifestFixture)));

  assert.deepEqual(manifest, manifestFixture);
  assert.equal(manifest.indexes.calendarRules['0'], 'a'.repeat(64));
  assert.equal(manifest.indexes.connectionBuckets[`${'a'.repeat(64)}-25`], `connections/${'a'.repeat(64)}-25.json.gz`);
});

test('reads historical schema-1 snapshots without the source provenance marker', () => {
  const historical = {
    ...manifestFixture,
    source: {
      packageId: 'iett-gtfs-verisi',
      resourceId: 'fixture-stop_times',
      resourceUrl: 'https://data.ibb.gov.tr/stop_times.csv',
      downloadedAt: '2026-11-10T12:00:00+03:00',
      etag: null,
    },
  };
  assert.deepEqual(parseManifest(historical), historical);
});

test('rejects each missing required manifest field', () => {
  for (const key of Object.keys(manifestFixture)) {
    const value: Record<string, unknown> = { ...manifestFixture };
    delete value[key];
    assert.throws(() => parseManifest(value), key);
  }
});

test('rejects unsupported manifest schema versions', () => {
  for (const schemaVersion of [2, '1']) {
    assert.throws(() => parseManifest({ ...manifestFixture, schemaVersion }));
  }
});

test('rejects invalid manifest date ranges and bounds', () => {
  assert.throws(() => parseManifest({
    ...manifestFixture,
    serviceDateRange: { start: '2026-02-30', end: '2026-11-10' },
  }));
  assert.throws(() => parseManifest({
    ...manifestFixture,
    serviceDateRange: { start: '2026-11-11', end: '2026-11-10' },
  }));
  assert.throws(() => parseManifest({
    ...manifestFixture,
    boundingBox: { ...manifestFixture.boundingBox, minLatitude: 42 },
  }));
});

test('rejects declared source provenance without complete resource digests', () => {
  const source = {
    ...manifestFixture.source,
    resources: {
      ...manifestFixture.source.resources,
      stops: { ...manifestFixture.source.resources.stops, sha256: undefined },
    },
  };
  assert.throws(() => parseManifest({ ...manifestFixture, source }));
});

test('rejects invalid inventory paths, sizes and hashes', () => {
  for (const path of ['stops-grid/../outside.json.gz', 'stops-grid\\outside.json.gz', '/outside.json.gz']) {
    const files = { ...manifestFixture.files, [path]: { bytes: 64, sha256: '2'.repeat(64) } };
    assert.throws(() => parseManifest({ ...manifestFixture, files }));
  }
  for (const entry of [{ bytes: 0, sha256: '2'.repeat(64) }, { bytes: 64 }]) {
    const files = { ...manifestFixture.files, 'content-links.json.gz': entry };
    assert.throws(() => parseManifest({ ...manifestFixture, files }));
  }
});

test('rejects a path lookup outside the file inventory', () => {
  const indexes = { ...manifestFixture.indexes, stops: { '0': 'stops-grid/undeclared.json.gz' } };
  assert.throws(() => parseManifest({ ...manifestFixture, indexes }));
});

test('rejects malformed service calendars in the indexes', () => {
  const indexes = structuredClone(manifestFixture.indexes);
  indexes.serviceClasses['a'.repeat(64)].calendar.weekdays[0] = 2;
  assert.throws(() => parseManifest({ ...manifestFixture, indexes }));
});

test('parses the public route preferences, coordinates and an offset departure', () => {
  for (const preference of ['fastest', 'less-walking', 'fewer-transfers']) {
    assert.deepEqual(parseRouteRequest(requestUrl({ preference }), now), {
      origin: [41.01, 29.01],
      destination: [41.05, 29.04],
      departureAt: new Date('2026-11-10T12:00:00.000Z'),
      preference,
    });
  }
});

test('rejects requests missing any required route parameter', () => {
  for (const field of requestUrl().searchParams.keys()) {
    assert.throws(() => parseRouteRequest(requestUrl({ [field]: null }), now));
  }
});

test('rejects duplicate route parameters', () => {
  const url = requestUrl();
  url.searchParams.append('originLat', '41.02');
  assert.throws(() => parseRouteRequest(url, now));
});

test('accepts the edges of the İstanbul bounds', () => {
  const value = parseRouteRequest(requestUrl({
    originLat: '39.5', originLng: '26', destinationLat: '42.5', destinationLng: '31.0',
  }), now);
  assert.deepEqual(value.origin, [39.5, 26]);
  assert.deepEqual(value.destination, [42.5, 31]);
});

test('rejects out-of-bounds, nonfinite and malformed coordinates', () => {
  const cases = {
    originLat: ['39.4999', '42.5001', 'NaN', 'Infinity', '41foo', ' ', '0x29'],
    originLng: ['25.9999', '31.0001'],
    destinationLat: ['39.4999', '42.5001'],
    destinationLng: ['25.9999', '31.0001'],
  };
  for (const [name, values] of Object.entries(cases)) {
    for (const value of values) {
      assert.throws(() => parseRouteRequest(requestUrl({ [name]: value }), now));
    }
  }
});

test('rejects non-ISO, offset-free and impossible departure times', () => {
  for (const departureAt of [
    'November 10, 2026', '2026-11-10', '2026-11-10T12:00:00',
    '2026-02-29T12:00:00Z', '2026-11-10T24:00:00Z', '2026-11-10T12:00:00+03:60',
  ]) {
    assert.throws(() => parseRouteRequest(requestUrl({ departureAt }), now));
  }
});

test('rejects unsupported route preferences', () => {
  for (const preference of ['time', 'walking', 'transfers', '']) {
    assert.throws(() => parseRouteRequest(requestUrl({ preference }), now));
  }
});

test('accepts past, current and exactly seven-days-ahead departure instants', () => {
  for (const departureAt of [
    '2024-02-29T12:00:00.000Z', '2026-11-10T12:00:00.000Z', '2026-11-17T12:00:00.000Z',
  ]) {
    const routeRequest = parseRouteRequest(requestUrl({ departureAt }), now);
    assert.equal(routeRequest.departureAt.toISOString(), departureAt);
  }
});

test('rejects a departure more than seven days ahead by absolute time', () => {
  const departureAt = '2026-11-17T15:00:00.001+03:00';
  assert.throws(() => parseRouteRequest(requestUrl({ departureAt }), now));
});
