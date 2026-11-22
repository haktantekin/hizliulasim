import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveVehicleHandler } from '../../../../services/iett-live.ts';

function request(query = 'hatKodu=1', token?: string): Request {
  return new Request(`http://localhost/api/iett/konum?${query}`, {
    headers: token ? { cookie: `auth_token=${token}` } : undefined,
  });
}

test('anonymous live vehicle requests return 401 without touching auth or İETT', async () => {
  let authCalls = 0;
  let providerCalls = 0;
  const handler = createLiveVehicleHandler({
    verifySession: async () => { authCalls++; return 'valid'; },
    getLocations: async () => { providerCalls++; return []; },
  });

  const response = await handler(request());

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), {
    code: 'AUTH_REQUIRED',
    error: 'Canlı araç konumlarını görmek için giriş yapmalısınız.',
  });
  assert.equal(authCalls, 0);
  assert.equal(providerCalls, 0);
});

test('invalid and unavailable sessions never reach the İETT provider', async (t) => {
  for (const [session, expectedStatus, expectedCode] of [
    ['invalid', 401, 'AUTH_REQUIRED'],
    ['unavailable', 503, 'AUTH_UNAVAILABLE'],
  ] as const) {
    await t.test(session, async () => {
      let providerCalls = 0;
      const handler = createLiveVehicleHandler({
        verifySession: async () => session,
        getLocations: async () => { providerCalls++; return []; },
      });

      const response = await handler(request('hatKodu=1', 'token'));

      assert.equal(response.status, expectedStatus);
      assert.equal((await response.json()).code, expectedCode);
      assert.equal(providerCalls, 0);
    });
  }
});

test('a verified member can request the normalized line code', async () => {
  const requested: string[] = [];
  const payload = [{ kapino: 'K-1' }];
  const handler = createLiveVehicleHandler({
    verifySession: async () => 'valid',
    getLocations: async (code) => { requested.push(code); return payload as never; },
  });

  const response = await handler(request('hatKodu=500t', 'token'));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(requested, ['500T']);
  assert.deepEqual(await response.json(), payload);
});

test('verified members share one provider result per line during the live cache window', async () => {
  let now = Date.parse('2026-11-22T10:00:00.000Z');
  let providerCalls = 0;
  const handler = createLiveVehicleHandler({
    verifySession: async () => 'valid',
    getLocations: async () => {
      providerCalls++;
      return [{ kapino: `K-${providerCalls}` }] as never;
    },
    now: () => now,
    liveCacheTtlMs: 60_000,
  });

  const first = await handler(request('hatKodu=500t', 'first-token'));
  const second = await handler(request('hatKodu=500T', 'second-token'));

  assert.equal(first.headers.get('X-IETT-Live-Cache'), 'MISS');
  assert.equal(second.headers.get('X-IETT-Live-Cache'), 'HIT');
  assert.equal(providerCalls, 1);

  now += 60_001;
  const refreshed = await handler(request('hatKodu=500t', 'third-token'));
  assert.equal(refreshed.headers.get('X-IETT-Live-Cache'), 'MISS');
  assert.equal(providerCalls, 2);
});

test('provider failures use a recent stale result without breaking the line page', async () => {
  let now = Date.parse('2026-11-22T10:00:00.000Z');
  let shouldFail = false;
  const handler = createLiveVehicleHandler({
    verifySession: async () => 'valid',
    getLocations: async () => {
      if (shouldFail) throw new Error('provider unavailable');
      return [{ kapino: 'K-1' }] as never;
    },
    now: () => now,
    liveCacheTtlMs: 60_000,
    liveStaleTtlMs: 5 * 60_000,
  });

  await handler(request('hatKodu=500t', 'token'));
  now += 60_001;
  shouldFail = true;

  const response = await handler(request('hatKodu=500t', 'token'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-IETT-Live-Cache'), 'STALE');
  assert.deepEqual(await response.json(), [{ kapino: 'K-1' }]);
});
