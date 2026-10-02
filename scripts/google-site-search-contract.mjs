import assert from 'node:assert/strict';
import test from 'node:test';

import * as searchPage from '../src/lib/searchPage.ts';
import { buildIettHatParams } from '../src/lib/iettRequest.ts';

const { buildGoogleSearchUrl } = searchPage;

test('builds a Google search URL restricted to hizliulasim.com', () => {
  assert.equal(
    buildGoogleSearchUrl('  Kadıköy   vapur  '),
    'https://www.google.com/search?q=site%3Ahizliulasim.com+Kad%C4%B1k%C3%B6y+vapur',
  );
});

test('uses Google only for general searches and preserves bus searches', () => {
  assert.equal(typeof searchPage.shouldUseGoogleSiteSearch, 'function');
  assert.equal(searchPage.shouldUseGoogleSiteSearch?.('Kadıköy vapur', undefined), true);
  assert.equal(searchPage.shouldUseGoogleSiteSearch?.('500T', 'otobus-hatlari'), false);
  assert.equal(searchPage.shouldUseGoogleSiteSearch?.('a', undefined), false);
});

test('builds the embedded Programmable Search script URL from the engine id', () => {
  assert.equal(typeof searchPage.buildGoogleProgrammableSearchScriptUrl, 'function');
  assert.equal(
    searchPage.buildGoogleProgrammableSearchScriptUrl?.(' engine:id '),
    'https://cse.google.com/cse.js?cx=engine%3Aid',
  );
});

test('uses the configured public search engine when no environment override exists', () => {
  assert.equal(typeof searchPage.resolveGoogleSearchEngineId, 'function');
  assert.equal(
    searchPage.resolveGoogleSearchEngineId?.(undefined),
    'a451c442f6af04df3',
  );
  assert.equal(
    searchPage.resolveGoogleSearchEngineId?.(' custom-engine '),
    'custom-engine',
  );
});

test('routes bus searches to IETT and general searches to Google', () => {
  assert.equal(searchPage.getSearchMode('500T', 'otobus-hatlari'), 'iett');
  assert.equal(searchPage.getSearchMode('Kadıköy vapur', undefined), 'google');
  assert.equal(searchPage.getSearchMode('a', 'otobus-hatlari'), 'idle');
});

test('builds canonical route links for IETT results', () => {
  assert.equal(searchPage.buildBusRouteHref('  500T  '), '/otobus-hatlari/500t');
  assert.equal(searchPage.buildBusRouteHref('KM46-ÖHO'), '/otobus-hatlari/km46-%C3%B6ho');
});

test('always sends the HatKodu SOAP parameter when requesting IETT routes', () => {
  assert.deepEqual(buildIettHatParams(), { HatKodu: '' });
  assert.deepEqual(buildIettHatParams(' 500t '), { HatKodu: '500T' });
});
