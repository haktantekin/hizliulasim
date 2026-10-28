import assert from 'node:assert/strict';
import test from 'node:test';

import * as minibusDataModule from './minibusData.ts';
import { loadMinibusDetailWithFallback } from './minibusDetailFallback.ts';
import type { MinibusCachedData } from './minibusData.ts';
import { fetchVerifiedOfficialMinibusStops } from './minibusOfficialClient.ts';
import { loadOfficialMinibusLineData } from './minibusOfficialFallback.ts';

const cmsDetail: MinibusCachedData = {
  sourceId: '{11111111-1111-1111-1111-111111111111}',
  details: { routeName: 'CMS Güzergâhı' },
  outboundRoute: [{ lat: 41.01, lng: 28.91 }],
  returnRoute: [],
  schedule: {
    weekdayOutbound: ['06:00'],
    weekdayReturn: [],
    weekendOutbound: [],
    weekendReturn: [],
  },
  stops: [{ id: 1, name: 'CMS Durağı' }],
  stopsVerified: true,
  errors: [],
};

const officialDetail: MinibusCachedData = {
  sourceId: '{22222222-2222-2222-2222-222222222222}',
  details: { routeName: 'İBB Güzergâhı' },
  outboundRoute: [{ lat: 41.02, lng: 28.92 }],
  returnRoute: [],
  schedule: {
    weekdayOutbound: ['07:00'],
    weekdayReturn: [],
    weekendOutbound: [],
    weekendReturn: [],
  },
  stops: [{ id: 2, name: 'İBB Durağı' }],
  stopsVerified: true,
  errors: [],
};

test('uses the verified line snapshot when the official list request fails', async () => {
  assert.equal(typeof minibusDataModule.loadMinibusLinesWithFallback, 'function');
  const loadWithFallback = minibusDataModule.loadMinibusLinesWithFallback as (
    loadLive: () => Promise<never>,
    snapshotPayload: unknown,
  ) => Promise<Array<{ code: string; slug: string }>>;

  const lines = await loadWithFallback(
    async () => { throw new Error('IBB unavailable from deployment'); },
    {
      d: [{
        Value: '{DEFAD4A5-6011-4447-AC4A-C5D8C6A640B2}',
        Text: 'A19 - Bakırköy-Hastane-Esenler-Atışalanı',
        Status: 'MİNİBÜS',
      }],
    },
  );

  assert.deepEqual(lines.map(({ code, slug }) => ({ code, slug })), [{
    code: 'A19',
    slug: 'a19-bakirkoy-hastane-esenler-atisalani',
  }]);
});

test('keeps CMS detail data without calling the official API fallback', async () => {
  let officialCallCount = 0;

  const result = await loadMinibusDetailWithFallback(cmsDetail, async () => {
    officialCallCount += 1;
    return officialDetail;
  });

  assert.equal(result, cmsDetail);
  assert.equal(officialCallCount, 0);
});

test('loads official API detail data when CMS has no saved detail', async () => {
  const result = await loadMinibusDetailWithFallback(null, async () => officialDetail);

  assert.equal(result, officialDetail);
  assert.equal(result?.details.routeName, 'İBB Güzergâhı');
  assert.deepEqual(result?.stops, [{ id: 2, name: 'İBB Durağı' }]);
});

test('returns no detail instead of crashing the page when the official fallback also fails', async () => {
  const fallbackError = new Error('İBB geçici olarak kullanılamıyor');
  let reportedError: unknown;

  const result = await loadMinibusDetailWithFallback(
    null,
    async () => { throw fallbackError; },
    (error) => { reportedError = error; },
  );

  assert.equal(result, null);
  assert.equal(reportedError, fallbackError);
});

test('selects the official route in a cookie session before reading stops with an empty object body', async () => {
  let routeSessionCount = 0;
  const stopCookies: string[] = [];

  const fetchImpl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/FindTheGuzergahAsync')) {
      routeSessionCount += 1;
      assert.deepEqual(JSON.parse(String(init?.body)), {
        Global_ID: '{22222222-2222-2222-2222-222222222222}',
        Turning_Point: '1',
        CarStatus: 'MİNİBÜS',
      });
      return Response.json(
        { d: JSON.stringify({ Result: JSON.stringify([{ lat: 41.02, lng: 28.92 }]) }) },
        { headers: { 'Set-Cookie': `ASP.NET_SessionId=session-${routeSessionCount}; Path=/` } },
      );
    }
    if (url.endsWith('/FindTheStops')) {
      assert.equal(init?.body, '{}');
      stopCookies.push(new Headers(init?.headers).get('cookie') ?? '');
      return Response.json({ d: [{ ID: 1, StopsName: 'Doğrulanmış Durak' }] });
    }
    throw new Error(`Beklenmeyen resmî API adresi: ${url}`);
  };

  const result = await fetchVerifiedOfficialMinibusStops(
    'https://example.test/MinibusumNerede.aspx',
    '{22222222-2222-2222-2222-222222222222}',
    'MİNİBÜS',
    fetchImpl,
  );

  assert.equal(routeSessionCount, 2);
  assert.deepEqual(stopCookies.sort(), [
    'ASP.NET_SessionId=session-1',
    'ASP.NET_SessionId=session-2',
  ]);
  assert.deepEqual(result, {
    verified: true,
    stops: [{ id: 1, name: 'Doğrulanmış Durak' }],
  });
});

test('keeps official route data when the general detail endpoint fails', async () => {
  const result = await loadOfficialMinibusLineData(
    {
      name: 'Pendik-Kiptaş Konutları (alternatif)',
      sourceIds: ['{33333333-3333-3333-3333-333333333333}'],
    },
    {
      details: async () => { throw new Error('FindTheMinibusDetails HTTP 500'); },
      route: async (_sourceId, turningPoint) => (
        turningPoint === 1 ? [{ lat: 40.88, lng: 29.23 }] : []
      ),
      schedule: async () => { throw new Error('FullListAsync HTTP 500'); },
      stops: async () => { throw new Error('FindTheStops HTTP 500'); },
    },
  );

  assert.equal(result.details.routeName, 'Pendik-Kiptaş Konutları (alternatif)');
  assert.deepEqual(result.outboundRoute, [{ lat: 40.88, lng: 29.23 }]);
  assert.equal(result.returnRoute.length, 0);
  assert.equal(result.errors.length, 3);
});
