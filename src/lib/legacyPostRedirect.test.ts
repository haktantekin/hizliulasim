import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { resolveLegacyPostDestination } = require('./legacyContentPaths.ts') as typeof import('./legacyContentPaths');

test('resolves a nested nasil-giderim URL from the WordPress post link', async () => {
  const destination = await resolveLegacyPostDestination(
    '/ulasim-rehberi/nasil-giderim/sultanahmet-camii',
    async (slug) => ({
      slug,
      link: 'https://www.hizliulasim.com/ulasim-rehberi/camiler/sultanahmet-camii/',
    }),
  );

  assert.equal(destination, '/ulasim-rehberi/camiler/sultanahmet-camii');
});

test('uses the last segment as the post slug for old blog URLs', async () => {
  let requestedSlug = '';
  await resolveLegacyPostDestination('/blog/gezi/galata-kulesi', async (slug) => {
    requestedSlug = slug;
    return null;
  });

  assert.equal(requestedSlug, 'galata-kulesi');
});

test('does not query WordPress for current URLs or redirect to another legacy URL', async () => {
  let lookupCount = 0;
  const currentDestination = await resolveLegacyPostDestination('/ulasim-rehberi/camiler/sultanahmet-camii', async () => {
    lookupCount += 1;
    return null;
  });
  const legacyDestination = await resolveLegacyPostDestination('/nasil-giderim/sultanahmet-camii', async (slug) => ({
    slug,
    link: 'https://cms.hizliulasim.com/blog/sultanahmet-camii/',
  }));

  assert.equal(currentDestination, null);
  assert.equal(legacyDestination, null);
  assert.equal(lookupCount, 0);
});
