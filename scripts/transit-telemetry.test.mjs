import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import nextConstants from 'next/constants.js';
import nextConfigLoader from 'next/dist/server/config.js';
import nextRequestLogger from 'next/dist/server/dev/log-requests.js';
import { googleAnalyticsId, googleAnalyticsSetup } from '../src/lib/googleAnalytics.ts';

test('hides shared planner query data while keeping the coordinate-free route API visible', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { logging } = await nextConfigLoader.default(nextConstants.PHASE_DEVELOPMENT_SERVER, root, { silent: true });
  const shouldIgnore = (url) => nextRequestLogger.ignoreLoggingIncomingRequests({ url }, logging);

  assert.equal(shouldIgnore('/yol-tarifi?o=41,29&d=41.1,29'), true);
  assert.equal(shouldIgnore('/yol-tarifi/?d=41.1%2C29'), true);
  assert.equal(shouldIgnore('/yol-tarifi?_rsc=x&o=41,29'), true);
  assert.equal(shouldIgnore('/api/transit/route'), false);
  assert.equal(shouldIgnore('/yol-tarifi'), false);
  assert.equal(shouldIgnore('/yol-tarifi-ornegi?o=41,29'), false);
  assert.equal(shouldIgnore('/yol-tarifi/detay?o=41,29'), false);
  assert.equal(shouldIgnore('/arama?q=otobus'), false);
});

function readAnalyticsConfig(path, referrer = '') {
  const window = { location: new URL(path, 'https://hizliulasim.com'), dataLayer: [] };
  runInNewContext(googleAnalyticsSetup, { window, document: { referrer }, URL });
  const config = window.dataLayer.filter((entry) => entry[0] === 'config');
  assert.equal(config.length, 1);
  return JSON.parse(JSON.stringify(Array.from(config[0])));
}

test('configures the planner page view without its query, fragment, or trailing slash', () => {
  const expected = ['config', googleAnalyticsId, {
    page_location: 'https://hizliulasim.com/yol-tarifi',
    page_path: '/yol-tarifi',
  }];
  assert.deepEqual(readAnalyticsConfig('/yol-tarifi?o=41%2C29&on=Ev#harita'), expected);
  assert.deepEqual(readAnalyticsConfig('/yol-tarifi/?d=41.1,29'), expected);
});

test('leaves analytics defaults in place for other pages', () => {
  const expected = ['config', googleAnalyticsId];
  assert.deepEqual(readAnalyticsConfig('/arama?q=otobus'), expected);
  assert.deepEqual(readAnalyticsConfig('/yol-tarifi-ornegi?o=41,29'), expected);
  assert.deepEqual(readAnalyticsConfig('/yol-tarifi/detay?d=41.1,29'), expected);
  assert.deepEqual(readAnalyticsConfig('/arama', 'https://example.org/yol-tarifi?o=41,29'), expected);
});

test('removes directions query data from same-site page referrers', () => {
  const expected = ['config', googleAnalyticsId, { page_referrer: 'https://hizliulasim.com/yol-tarifi' }];
  assert.deepEqual(readAnalyticsConfig('/arama?q=otobus', 'https://hizliulasim.com/yol-tarifi/?o=41,29&on=Ev'), expected);
});
