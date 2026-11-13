import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGoogleLinkPost } from './handler.ts';

const identity = {
  sub: 'google-subject-1',
  email: 'user@example.com',
  emailVerified: true as const,
  name: 'Örnek Kullanıcı',
  picture: 'https://lh3.googleusercontent.com/avatar',
};

const config = {
  clientId: 'client-id.apps.googleusercontent.com',
  bridgeSecret: 'b'.repeat(32),
  wpApi: 'https://cms.hizliulasim.com/wp-json',
};

const makeRequest = (body: unknown) => new Request('http://localhost:3000/api/auth/google/link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('rejects a missing site session before Google verification or CMS access', async (t) => {
  const verifyCredential = t.mock.fn(async () => identity);
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json({}));
  const post = createGoogleLinkPost({ config, verifyCredential, fetchImpl });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }), undefined);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Google hesabını bağlamak için yeniden giriş yapın.' });
  assert.equal(verifyCredential.mock.callCount(), 0);
  assert.equal(fetchImpl.mock.callCount(), 0);
});

test('rejects a malformed credential before verification or CMS access', async (t) => {
  const verifyCredential = t.mock.fn(async () => identity);
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json({}));
  const post = createGoogleLinkPost({ config, verifyCredential, fetchImpl });

  const response = await post(makeRequest({ credential: 'not-a-jwt' }), 'site-access-token');

  assert.equal(response.status, 400);
  assert.equal(verifyCredential.mock.callCount(), 0);
  assert.equal(fetchImpl.mock.callCount(), 0);
});

test('verifies Google and sends an authenticated signed link request to WordPress', async (t) => {
  const verifyCredential = t.mock.fn(async () => identity);
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json({
    linked: true,
    email: 'user@example.com',
  }));
  const post = createGoogleLinkPost({
    config,
    verifyCredential,
    fetchImpl,
    now: () => 1_700_000_000,
    nonce: () => 'nonce-link-123',
  });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }), 'site-access-token');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { linked: true, email: 'user@example.com' });
  assert.deepEqual(verifyCredential.mock.calls[0].arguments, ['header.payload.signature', config.clientId]);
  const [url, init] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url, `${config.wpApi}/hizliulasim/v1/auth/google/link`);
  const headers = new Headers(init?.headers);
  assert.equal(headers.get('authorization'), 'Bearer site-access-token');
  assert.equal(headers.get('x-hizliulasim-timestamp'), '1700000000');
  assert.match(String(headers.get('x-hizliulasim-signature')), /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(JSON.parse(String(init?.body)).nonce, 'nonce-link-123');
});

test('maps CMS identity conflicts to safe account-link messages', async (t) => {
  const post = createGoogleLinkPost({
    config,
    verifyCredential: async () => identity,
    fetchImpl: t.mock.fn<typeof fetch>(async () => Response.json({
      code: 'google_identity_in_use',
      message: 'private upstream detail',
    }, { status: 409 })),
  });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }), 'site-access-token');

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    message: 'Bu Google hesabı başka bir üyeliğe bağlı.',
    code: 'google_identity_in_use',
  });
});

test('fails closed when WordPress returns an invalid success envelope', async (t) => {
  const post = createGoogleLinkPost({
    config,
    verifyCredential: async () => identity,
    fetchImpl: t.mock.fn<typeof fetch>(async () => Response.json({ linked: false, email: identity.email })),
  });

  const response = await post(makeRequest({ credential: 'header.payload.signature' }), 'site-access-token');

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { message: 'Google hesabı bağlanamadı.' });
});
