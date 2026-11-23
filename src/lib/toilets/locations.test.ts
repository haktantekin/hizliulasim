import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocationOptions, locationKey } from './locations.ts';

test('groups Ankara, İzmir and İstanbul spelling variants into one filter option each', () => {
  const values = ['ankara', 'Ankara', 'ANKARA', 'Izmir', 'izmir', 'İzmir', 'İZMİR', 'Istanbul', 'istanbul', 'İstanbul'];
  assert.deepEqual(buildLocationOptions(values), [
    { key: 'ankara', label: 'Ankara' },
    { key: 'istanbul', label: 'İstanbul' },
    { key: 'izmir', label: 'İzmir' },
  ]);
  assert.equal(values.filter((name) => locationKey(name) === 'izmir').length, 4);
});

test('preserves settlement options and prefers Turkish spelling without inferring a city', () => {
  assert.deepEqual(buildLocationOptions([null, '', ' ', 'Bozburun', 'bozburun', 'Cesme', 'Çeşme']), [
    { key: 'bozburun', label: 'Bozburun' },
    { key: 'cesme', label: 'Çeşme' },
  ]);
});
