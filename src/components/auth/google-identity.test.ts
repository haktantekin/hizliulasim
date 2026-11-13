import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  buildGoogleButtonOptions,
  extractGoogleCredential,
  getGoogleClientId,
} from './google-identity.ts';

test('uses the supplied public Web Client ID and keeps the configured fallback', () => {
  assert.equal(
    DEFAULT_GOOGLE_CLIENT_ID,
    '208603820160-hbs70saa6umg9gbut6gs3g596vs8fjhh.apps.googleusercontent.com',
  );
  assert.equal(getGoogleClientId(' custom-client.apps.googleusercontent.com '), 'custom-client.apps.googleusercontent.com');
  assert.equal(getGoogleClientId(''), DEFAULT_GOOGLE_CLIENT_ID);
});

test('builds the official Turkish popup button within GIS width limits', () => {
  assert.deepEqual(buildGoogleButtonOptions(368), {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    locale: 'tr',
    width: 368,
  });
  assert.equal(buildGoogleButtonOptions(900).width, 400);
  assert.equal(buildGoogleButtonOptions(100).width, 200);
});

test('accepts only a bounded three-part GIS credential callback', () => {
  assert.equal(
    extractGoogleCredential({ credential: 'header.payload.signature' }),
    'header.payload.signature',
  );
  assert.throws(() => extractGoogleCredential({}), /alınamadı/u);
  assert.throws(() => extractGoogleCredential({ credential: 'not-a-jwt' }), /alınamadı/u);
  assert.throws(() => extractGoogleCredential({ credential: 'x'.repeat(8193) }), /alınamadı/u);
});
