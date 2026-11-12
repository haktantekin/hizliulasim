import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTransitPathStyle, TRANSIT_BASEMAP_OPACITY } from './map-style.ts';

test('mutes the basemap and gives every route a wider light casing', () => {
  assert.equal(TRANSIT_BASEMAP_OPACITY, 0.42);
  assert.deepEqual(getTransitPathStyle({ size: 'compact', dashed: false, highlighted: false, dimmed: false }), {
    casing: { color: '#ffffff', weight: 10, opacity: 0.92, lineCap: 'round', lineJoin: 'round' },
    route: { weight: 6, opacity: 1, lineCap: 'round', lineJoin: 'round' },
  });
});

test('keeps approximate and selected paths easy to distinguish on the quiet basemap', () => {
  assert.deepEqual(getTransitPathStyle({ size: 'full', dashed: true, highlighted: true, dimmed: false }), {
    casing: {
      color: '#ffffff', weight: 13, opacity: 1, dashArray: '14 10', lineCap: 'round', lineJoin: 'round',
    },
    route: { weight: 9, opacity: 1, dashArray: '14 10', lineCap: 'round', lineJoin: 'round' },
  });
  assert.equal(getTransitPathStyle({ size: 'full', dashed: false, highlighted: false, dimmed: true }).route.opacity, 0.3);
});
