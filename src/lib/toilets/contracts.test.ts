import assert from 'node:assert/strict';
import test from 'node:test';
import { parseToiletEnvelope, type ToiletEnvelope } from './contracts.ts';
import { fixtureEnvelope } from './test-fixtures.ts';

test('keeps unknown fees/accessibility and customer restrictions without assuming free/public access', () => {
  const value = parseToiletEnvelope(fixtureEnvelope());
  assert.equal(value.toilets[0].fee, 'unknown');
  assert.equal(value.toilets[0].wheelchair, 'unknown');
  assert.equal(value.toilets[1].access, 'customers');
});

test('rejects partial datasets, duplicate IDs, swapped coordinates and unsafe links', () => {
  for (const mutate of [
    (data: ToiletEnvelope) => { data.sources.osm.count = 2; },
    (data: ToiletEnvelope) => { data.toilets.push({ ...data.toilets[1] }); data.sources.osm.count++; },
    (data: ToiletEnvelope) => { data.toilets[0].lat = 29; data.toilets[0].lng = 41; },
    (data: ToiletEnvelope) => { data.toilets[0].sourceUrl = 'javascript:alert(1)'; },
    (data: ToiletEnvelope) => { data.sources.ibb.updatedAt = null; },
    (data: ToiletEnvelope) => { data.updatedAt = '2026-11-20T08:00:00Z'; },
    (data: ToiletEnvelope) => { data.toilets[1].sourceUrl = 'https://malicious.example/node/1'; },
  ]) {
    const data = fixtureEnvelope();
    mutate(data);
    assert.throws(() => parseToiletEnvelope(data), TypeError);
  }
});
