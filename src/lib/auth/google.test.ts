import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import {
  buildGoogleBridgeRequest,
  normalizeGooglePayload,
  validateGoogleCredentialInput,
} from './google.ts';

test('rejects missing and oversized Google credentials before verification', () => {
  assert.throws(() => validateGoogleCredentialInput(''), /geçersiz/u);
  assert.throws(() => validateGoogleCredentialInput('x'.repeat(8193)), /geçersiz/u);
  assert.equal(validateGoogleCredentialInput('header.payload.signature'), 'header.payload.signature');
});

test('accepts only verified Google identities with a stable subject and email', () => {
  assert.deepEqual(normalizeGooglePayload({
    sub: 'google-subject-1',
    email: 'user@example.com',
    email_verified: true,
    name: 'Örnek Kullanıcı',
    picture: 'https://lh3.googleusercontent.com/avatar',
  }), {
    sub: 'google-subject-1',
    email: 'user@example.com',
    emailVerified: true,
    name: 'Örnek Kullanıcı',
    picture: 'https://lh3.googleusercontent.com/avatar',
  });

  assert.throws(() => normalizeGooglePayload({
    sub: 'google-subject-1', email: 'user@example.com', email_verified: false,
  }), /doğrulanamadı/u);
  assert.throws(() => normalizeGooglePayload({
    email: 'user@example.com', email_verified: true,
  }), /doğrulanamadı/u);
});

test('creates a short-lived HMAC assertion over the exact WordPress request body', () => {
  const secret = 'a'.repeat(32);
  const identity = {
    sub: 'google-subject-1',
    email: 'user@example.com',
    emailVerified: true as const,
    name: 'Örnek Kullanıcı',
    picture: '',
  };
  const request = buildGoogleBridgeRequest(identity, secret, 1_700_000_000, 'nonce-123');

  const body = JSON.parse(request.body);
  assert.deepEqual(body, {
    version: 1,
    sub: 'google-subject-1',
    email: 'user@example.com',
    emailVerified: true,
    name: 'Örnek Kullanıcı',
    picture: '',
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_000_060,
    nonce: 'nonce-123',
  });
  assert.equal(request.timestamp, '1700000000');
  assert.equal(
    request.signature,
    createHmac('sha256', secret).update(request.body, 'utf8').digest('base64url'),
  );
  assert.throws(() => buildGoogleBridgeRequest(identity, 'short', 1_700_000_000, 'nonce'), /yapılandırılmamış/u);
});
