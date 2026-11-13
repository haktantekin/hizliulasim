import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const staticRoutes = ['hatlar', 'sefer-saatleri', 'durak-detay', 'durak', 'durak-hatlar', 'yakin-durak'];

test('all static İETT routes use the local-first service and never import the live vehicle method', async () => {
  for (const route of staticRoutes) {
    const source = await readFile(join(root, route, 'route.ts'), 'utf8');
    assert.match(source, /services\/iett-static/u, route);
    assert.doesNotMatch(source, /getHatOtoKonum|services\/iett['"]/u, route);
    assert.match(source, /iettStaticResponseHeaders/u, route);
  }
});

test('the live vehicle route remains separate from the public static package', async () => {
  const source = await readFile(join(root, 'konum', 'route.ts'), 'utf8');
  assert.match(source, /getHatOtoKonum/u);
  assert.doesNotMatch(source, /iett-static/u);
});
