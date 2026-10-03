import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  buildRedirectManifest,
  loadRedirectManifest,
  loadRedirectManifestWithFallback,
} = require('./redirectManifest.ts') as typeof import('./redirectManifest');

test('builds permanent redirects and removes unsafe or looping records', () => {
  const redirects = buildRedirectManifest([
    { source: '/eski-sayfa', destination: '/yeni-sayfa/' },
    { source: '/tam-url', destination: 'http://www.hizliulasim.com/yeni-hedef/' },
    { source: '/dongu', destination: 'https://hizliulasim.com/dongu' },
    { source: '/yerel', destination: 'http://localhost:3000/hedef' },
    { source: '/gecersiz', destination: 'javascript:alert(1)' },
  ]);

  assert.deepEqual(redirects, [
    { source: '/eski-sayfa', destination: '/yeni-sayfa', statusCode: 301 },
    { source: '/tam-url', destination: '/yeni-hedef', statusCode: 301 },
    { source: '/yerel', destination: '/hedef', statusCode: 301 },
  ]);
});

test('loads the complete redirect list with one CMS request', async () => {
  let requestCount = 0;
  let requestedUrl = '';
  const redirects = await loadRedirectManifest({
    fetchImpl: async (input) => {
      requestCount += 1;
      requestedUrl = String(input);
      return new Response(JSON.stringify([
        { source: '/bir', destination: '/iki' },
        { source: '/uc', destination: '/dort' },
      ]));
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(new URL(requestedUrl).searchParams.has('source'), false);
  assert.deepEqual(redirects, [
    { source: '/bir', destination: '/iki', statusCode: 301 },
    { source: '/uc', destination: '/dort', statusCode: 301 },
  ]);
});

test('retries a transient CMS failure before returning the manifest', async () => {
  let requestCount = 0;
  const redirects = await loadRedirectManifest({
    attempts: 2,
    retryDelayMs: 0,
    fetchImpl: async () => {
      requestCount += 1;
      if (requestCount === 1) return new Response('unavailable', { status: 503 });
      return new Response(JSON.stringify([{ source: '/eski', destination: '/yeni' }]));
    },
  });

  assert.equal(requestCount, 2);
  assert.deepEqual(redirects, [
    { source: '/eski', destination: '/yeni', statusCode: 301 },
  ]);
});

test('uses a validated snapshot when the CMS manifest cannot be refreshed', async () => {
  const result = await loadRedirectManifestWithFallback({
    attempts: 1,
    minimumRules: 2,
    fallbackPayload: [
      { source: '/bir', destination: '/iki' },
      { source: '/uc', destination: '/dort' },
    ],
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  });

  assert.equal(result.usedFallback, true);
  assert.ok(result.refreshError instanceof Error);
  assert.deepEqual(result.manifest, [
    { source: '/bir', destination: '/iki', statusCode: 301 },
    { source: '/uc', destination: '/dort', statusCode: 301 },
  ]);
});
