import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatIettFreshness, parseIettFreshnessHeaders, scheduleDataLabel } from './presentation.ts';

test('parses current package freshness headers and formats a Turkish update time', () => {
  const headers = new Headers({
    'X-Hizliulasim-Data-Source': 'iett-current',
    'X-Hizliulasim-Data-Version': '20261113T090000Z_aabbccddeeff0011',
    'X-Hizliulasim-Data-Generated-At': '2026-11-13T09:00:00Z',
  });
  const freshness = parseIettFreshnessHeaders(headers);
  assert.deepEqual(freshness, {
    source: 'current', version: '20261113T090000Z_aabbccddeeff0011', generatedAt: '2026-11-13T09:00:00Z',
  });
  const formatted = formatIettFreshness(freshness);
  assert.ok(formatted);
  assert.match(formatted, /^Veri güncellemesi: 13 Kasım 2026 /u);
});

test('labels the previous verified package without exposing a runtime fallback state', () => {
  const previous = formatIettFreshness({ source: 'previous', version: 'v1', generatedAt: '2026-11-12T09:00:00Z' });
  assert.ok(previous);
  assert.match(previous, /Önceki doğrulanmış veri/u);
  assert.equal(scheduleDataLabel, 'Planlanan');
});

test('rejects malformed freshness headers', () => {
  assert.equal(parseIettFreshnessHeaders(new Headers({ 'X-Hizliulasim-Data-Source': 'live' })), null);
  assert.equal(parseIettFreshnessHeaders(new Headers({ 'X-Hizliulasim-Data-Source': 'iett-legacy' })), null);
  assert.equal(parseIettFreshnessHeaders(new Headers({
    'X-Hizliulasim-Data-Source': 'iett-current',
    'X-Hizliulasim-Data-Generated-At': 'not-a-date',
  })), null);
});
