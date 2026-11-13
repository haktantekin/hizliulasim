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
