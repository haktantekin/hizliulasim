import assert from 'node:assert/strict';
import test from 'node:test';

test('keeps the fixed bottom navigation above Leaflet controls', async () => {
  const layerModule: Partial<typeof import('./uiLayers.ts')> = await import('./uiLayers.ts').catch(() => ({}));
  const getBottomBarLayerStyle = layerModule.getBottomBarLayerStyle;

  assert.equal(typeof getBottomBarLayerStyle, 'function');
  assert.ok(getBottomBarLayerStyle);

  const style = getBottomBarLayerStyle();

  assert.equal(style.position, 'fixed');
  assert.ok(Number(style.zIndex) > 1000, 'bottom navigation must render above Leaflet controls and markers');
});
