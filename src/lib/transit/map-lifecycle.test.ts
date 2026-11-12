import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canDrawTransitMap } from './map-lifecycle.ts';

test('rejects a Leaflet map removed during Fast Refresh before layers are attached', () => {
  const liveMap = { getPane: (name: string) => name === 'overlayPane' ? {} : undefined };
  const removedMap = { getPane: () => undefined };

  assert.equal(canDrawTransitMap(liveMap, liveMap), true);
  assert.equal(canDrawTransitMap(null, liveMap), false);
  assert.equal(canDrawTransitMap(liveMap, removedMap), false);
  assert.equal(canDrawTransitMap(removedMap, removedMap), false);
});
