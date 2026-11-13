import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const staticRoutes = ['hatlar', 'sefer-saatleri', 'durak-detay', 'guzergah', 'durak', 'durak-hatlar', 'yakin-durak'];

test('all static İETT routes use the local-first service and never import the live vehicle method', async () => {
  for (const route of staticRoutes) {
    const source = await readFile(join(root, route, 'route.ts'), 'utf8');
    assert.match(source, /services\/iett-static/u, route);
    assert.doesNotMatch(source, /getHatOtoKonum|services\/iett['"]/u, route);
    assert.match(source, /iettStaticResponseHeaders/u, route);
    assert.match(source, /iettStaticErrorResponse/u, route);
  }
});

test('static package errors map to a sanitized 503 response', async () => {
  const { IettStaticSourceError } = await import('../../../lib/iett-static/source.ts');
  const { iettStaticErrorResponse } = await import('./static-response.ts');
  const response = iettStaticErrorResponse(new IettStaticSourceError('DATA_UNAVAILABLE'));
  assert.equal(response?.status, 503);
  assert.deepEqual(await response?.json(), { error: 'DATA_UNAVAILABLE' });
  assert.equal(iettStaticErrorResponse(new Error('unexpected')), null);
});

test('the live vehicle route remains separate from the public static package', async () => {
  const source = await readFile(join(root, 'konum', 'route.ts'), 'utf8');
  assert.match(source, /getHatOtoKonum/u);
  assert.doesNotMatch(source, /iett-static/u);
});
