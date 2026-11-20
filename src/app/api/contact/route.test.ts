import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContactPost } from './handler.ts';

const config = {
  smtpHost: 'smtp.example.com',
  smtpPort: 465,
  smtpUser: 'contact@example.com',
  smtpPass: 'secret',
  contactTo: 'owner@example.com',
  siteUrl: 'https://hizliulasim.com',
  requireOrigin: true,
};

const validBody = {
  name: 'Test Kullanıcı',
  email: 'test@example.com',
  subject: 'Öneri',
  message: 'Bu, yeterince uzun bir test mesajıdır.',
  website: '',
};

function makeRequest(
  body: unknown = validBody,
  headers: Record<string, string> = {},
) {
  return new Request('https://hizliulasim.com/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://hizliulasim.com',
      'Sec-Fetch-Site': 'same-origin',
      'X-Vercel-Forwarded-For': '203.0.113.10',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('sends one validated message and starts the browser cooldown', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const takeRateLimit = t.mock.fn(() => ({ allowed: true, retryAfterSeconds: 0 }));
  const post = createContactPost({
    config,
    sendMail,
    takeRateLimit,
    now: () => 1_700_000_000_000,
    getClientKey: () => 'client-key',
  });

  const response = await post(makeRequest());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('set-cookie') || '', /hu_contact_sent=1/u);
  assert.match(response.headers.get('set-cookie') || '', /Max-Age=300/u);
  assert.match(response.headers.get('set-cookie') || '', /HttpOnly/u);
  assert.equal(sendMail.mock.callCount(), 1);
  assert.equal(takeRateLimit.mock.callCount(), 1);
  assert.deepEqual(takeRateLimit.mock.calls[0].arguments, ['client-key', 1_700_000_000_000]);
  assert.deepEqual(sendMail.mock.calls[0].arguments[0], {
    from: '"Hızlı Ulaşım İletişim" <contact@example.com>',
    to: 'owner@example.com',
    replyTo: '"Test Kullanıcı" <test@example.com>',
    subject: '[Hızlı Ulaşım İletişim] Öneri',
    text: 'Ad Soyad: Test Kullanıcı\nE-posta: test@example.com\nKonu: Öneri\n\nMesaj:\nBu, yeterince uzun bir test mesajıdır.',
  });
});

test('silently discards messages that fill the honeypot', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const takeRateLimit = t.mock.fn(() => ({ allowed: true, retryAfterSeconds: 0 }));
  const post = createContactPost({ config, sendMail, takeRateLimit });

  const response = await post(makeRequest({ ...validBody, website: 'https://spam.example' }));

  assert.equal(response.status, 200);
  assert.equal(sendMail.mock.callCount(), 0);
  assert.equal(takeRateLimit.mock.callCount(), 0);
});

test('rejects cross-site posts before parsing or sending mail', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const takeRateLimit = t.mock.fn(() => ({ allowed: true, retryAfterSeconds: 0 }));
  const post = createContactPost({ config, sendMail, takeRateLimit });

  const response = await post(makeRequest(validBody, {
    Origin: 'https://attacker.example',
    'Sec-Fetch-Site': 'cross-site',
  }));

  assert.equal(response.status, 403);
  assert.equal(sendMail.mock.callCount(), 0);
  assert.equal(takeRateLimit.mock.callCount(), 0);
});

test('rejects values outside the public form contract', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const post = createContactPost({ config, sendMail });

  const response = await post(makeRequest({
    ...validBody,
    subject: 'Injected subject',
  }));

  assert.equal(response.status, 400);
  assert.equal(sendMail.mock.callCount(), 0);
});

test('blocks a second browser submission during the cooldown', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const takeRateLimit = t.mock.fn(() => ({ allowed: true, retryAfterSeconds: 0 }));
  const post = createContactPost({ config, sendMail, takeRateLimit });

  const response = await post(makeRequest(validBody, { Cookie: 'hu_contact_sent=1' }));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '300');
  assert.deepEqual(await response.json(), {
    message: 'Yeni bir mesaj göndermek için 5 dakika bekleyin.',
    retryAfterSeconds: 300,
  });
  assert.equal(sendMail.mock.callCount(), 0);
  assert.equal(takeRateLimit.mock.callCount(), 0);
});

test('returns the IP rate-limit window without invoking SMTP', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const post = createContactPost({
    config,
    sendMail,
    takeRateLimit: () => ({ allowed: false, retryAfterSeconds: 125 }),
  });

  const response = await post(makeRequest());

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '125');
  assert.equal((await response.json()).retryAfterSeconds, 125);
  assert.equal(sendMail.mock.callCount(), 0);
});

test('limits an IP to five accepted messages in ten minutes', async (t) => {
  const sendMail = t.mock.fn(async (mail: unknown) => { void mail; });
  const post = createContactPost({
    config,
    sendMail,
    now: () => 1_700_000_000_000,
    getClientKey: () => 'rate-limit-test-client',
  });

  for (let index = 0; index < 5; index += 1) {
    assert.equal((await post(makeRequest())).status, 200);
  }
  const blocked = await post(makeRequest());

  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '600');
  assert.equal(sendMail.mock.callCount(), 5);
});
