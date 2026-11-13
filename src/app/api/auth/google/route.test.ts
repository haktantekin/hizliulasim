import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGoogleAuthPost } from './handler.ts';

const identity = {
  sub: 'google-subject-1',
  email: 'user@example.com',
  emailVerified: true as const,
  name: 'Örnek Kullanıcı',
  picture: '',
};

const makeRequest = (body: unknown) => new Request('http://localhost:3000/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const config = {
  clientId: 'client-id.apps.googleusercontent.com',
  bridgeSecret: 'b'.repeat(32),
  wpApi: 'https://cms.hizliulasim.com/wp-json',
};

test('rejects malformed credentials before Google verification or WordPress exchange', async (t) => {
  const verifyCredential = t.mock.fn(async () => identity);
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json({}));
  const post = createGoogleAuthPost({ config, verifyCredential, fetchImpl });

  const response = await post(makeRequest({ credential: 'x'.repeat(8193) }));

  assert.equal(response.status, 400);
  assert.equal(verifyCredential.mock.callCount(), 0);
  assert.equal(fetchImpl.mock.callCount(), 0);
});

test('verifies Google, signs the WordPress exchange, and creates existing auth cookies', async (t) => {
  const verifyCredential = t.mock.fn(async () => identity);
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json({
    user: { id: 7, email: identity.email, name: identity.name, username: 'ornek', role: 'subscriber' },
    tokens: { access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600 },
  }));
  const post = createGoogleAuthPost({
    config,
    verifyCredential,
    fetchImpl,
    now: () => 1_700_000_000,
    nonce: () => 'nonce-123',
  });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    user: { id: 7, email: identity.email, name: identity.name, username: 'ornek', role: 'subscriber' },
  });
  assert.equal(verifyCredential.mock.callCount(), 1);
  assert.deepEqual(verifyCredential.mock.calls[0].arguments, ['header.payload.signature', config.clientId]);
  assert.equal(fetchImpl.mock.callCount(), 1);
  const [url, init] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url, `${config.wpApi}/hizliulasim/v1/auth/google`);
  assert.equal(init?.method, 'POST');
  assert.ok(init?.signal instanceof AbortSignal);
  assert.equal(new Headers(init?.headers).get('x-hizliulasim-timestamp'), '1700000000');
  assert.match(String(new Headers(init?.headers).get('x-hizliulasim-signature')), /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(JSON.parse(String(init?.body)).nonce, 'nonce-123');
  const cookies = response.headers.getSetCookie().join(';');
  assert.match(cookies, /auth_token=access-token/u);
  assert.match(cookies, /refresh_token=refresh-token/u);
  assert.match(cookies, /HttpOnly/u);
  assert.match(cookies, /SameSite=lax/ui);
});

test('maps an existing-email conflict to a safe account-link message', async (t) => {
  const post = createGoogleAuthPost({
    config,
    verifyCredential: async () => identity,
    fetchImpl: t.mock.fn<typeof fetch>(async () => Response.json({
      code: 'account_link_required',
      message: 'private upstream detail',
    }, { status: 409 })),
  });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    message: 'Bu e-posta ile kayıtlı bir hesap var. Güvenliğiniz için e-posta ve şifrenizle giriş yapın.',
    code: 'account_link_required',
  });
});

test('fails closed when server-side Google configuration is missing', async (t) => {
  const verifyCredential = t.mock.fn(async () => identity);
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json({}));
  const post = createGoogleAuthPost({
    config: { ...config, bridgeSecret: '' },
    verifyCredential,
    fetchImpl,
  });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }));
  assert.equal(response.status, 503);
  assert.equal(verifyCredential.mock.callCount(), 0);
  assert.equal(fetchImpl.mock.callCount(), 0);
});
