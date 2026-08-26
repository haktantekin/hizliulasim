import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { getCanonicalRequestUrl } = require('./canonicalRequestUrl.ts') as typeof import('./canonicalRequestUrl');

test('removes www and trailing slash in one canonical redirect', () => {
  const canonicalUrl = getCanonicalRequestUrl({
    requestUrl: 'https://www.hizliulasim.com/ulasim-rehberi/avmler/capacity-avm/',
    forwardedProtocol: 'https',
    host: 'www.hizliulasim.com',
  });

  assert.equal(canonicalUrl?.toString(), 'https://hizliulasim.com/ulasim-rehberi/avmler/capacity-avm');
});

test('returns null for an already canonical URL', () => {
  const canonicalUrl = getCanonicalRequestUrl({
    requestUrl: 'https://hizliulasim.com/ulasim-rehberi/avmler/capacity-avm',
    forwardedProtocol: 'https',
    host: 'hizliulasim.com',
  });

  assert.equal(canonicalUrl, null);
});
