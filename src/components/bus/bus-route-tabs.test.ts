import assert from 'node:assert/strict';
import test from 'node:test';

test('adds an En Yakın Durak tab when the line has stops', async () => {
  const tabsModule: Partial<typeof import('./bus-route-tabs.ts')> = await import('./bus-route-tabs.ts').catch(() => ({}));
  const buildBusRouteTabs = tabsModule.buildBusRouteTabs;

  assert.equal(typeof buildBusRouteTabs, 'function');
  assert.ok(buildBusRouteTabs);

  assert.deepEqual(
    buildBusRouteTabs({ lineCode: '78F', stopCount: 42, hasWpContent: true }),
    [
      { id: 'schedule', label: '78F Sefer Saatleri' },
      { id: 'route', label: 'Güzergah' },
      { id: 'nearest', label: 'En Yakın Durak' },
      { id: 'info', label: '78F Hat Bilgileri' },
    ],
  );
});

test('does not offer the nearest-stop tab without stop data', async () => {
  const tabsModule: Partial<typeof import('./bus-route-tabs.ts')> = await import('./bus-route-tabs.ts').catch(() => ({}));
  const buildBusRouteTabs = tabsModule.buildBusRouteTabs;

  assert.equal(typeof buildBusRouteTabs, 'function');
  assert.ok(buildBusRouteTabs);

  assert.deepEqual(
    buildBusRouteTabs({ lineCode: '78F', stopCount: 0, hasWpContent: false }),
    [
      { id: 'schedule', label: '78F Sefer Saatleri' },
      { id: 'route', label: 'Güzergah' },
    ],
  );
});
