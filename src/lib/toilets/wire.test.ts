import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureEnvelope } from './test-fixtures.ts';
import { decodeToiletEnvelope, encodeToiletEnvelope } from './wire.ts';

test('compact wire format preserves every field and metadata while omitting repeated defaults', () => {
  const data = fixtureEnvelope();
  data.metadata = { storage: 'database', stale: true };
  const wire = encodeToiletEnvelope(data);
  assert.equal(wire.encoding, 'compact-v1');
  assert.equal(wire.toilets[0].fee, undefined);
  assert.equal(wire.toilets[1].sourceUrl, undefined);
  assert.ok(JSON.stringify(wire).length < JSON.stringify(data).length);
  assert.deepEqual(decodeToiletEnvelope(wire), data);
  assert.deepEqual(decodeToiletEnvelope(data), data);
});

test('fuel venues retain fees, access restrictions, hours and accessibility when provided', () => {
  const data = fixtureEnvelope();
  Object.assign(data.toilets[1], {
    kind: 'fuel', fee: 'no', access: 'customers', wheelchair: 'limited',
    changingTable: 'yes', openingHours: 'Mo-Su 08:00-22:00', status: 'seasonal',
  });
  assert.deepEqual(decodeToiletEnvelope(encodeToiletEnvelope(data)), data);
});

test('compact records still undergo full validation instead of supplying unsafe links or missing fields', () => {
  for (const mutate of [
    (wire: ReturnType<typeof encodeToiletEnvelope>) => { wire.toilets[0].sourceUrl = 'javascript:alert(1)'; },
    (wire: ReturnType<typeof encodeToiletEnvelope>) => { wire.toilets[1].lng = 999; },
    (wire: ReturnType<typeof encodeToiletEnvelope>) => { wire.sources.osm.count = 99; },
    (wire: ReturnType<typeof encodeToiletEnvelope>) => { wire.toilets[1].id = 'osm:invalid'; },
  ]) {
    const wire = encodeToiletEnvelope(fixtureEnvelope());
    mutate(wire);
    assert.throws(() => decodeToiletEnvelope(wire), TypeError);
  }
  assert.throws(() => decodeToiletEnvelope({ ...fixtureEnvelope(), encoding: 'unsupported' }), TypeError);
  assert.throws(() => decodeToiletEnvelope({
    ...encodeToiletEnvelope(fixtureEnvelope()), metadata: { storage: ['database'], stale: true },
  }), TypeError);
  assert.throws(() => decodeToiletEnvelope({
    ...encodeToiletEnvelope(fixtureEnvelope()), metadata: { storage: 'snapshot', stale: true },
  }), TypeError);
});
