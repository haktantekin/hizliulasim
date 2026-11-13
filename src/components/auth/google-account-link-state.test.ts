import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getGoogleAccountLinkView, getGoogleLinkErrorMessage } from './google-account-link-state.ts';

test('shows an action only for accounts that are not linked to Google', () => {
  assert.deepEqual(getGoogleAccountLinkView(false), {
    linked: false,
    title: 'Google hesabı bağlı değil',
    description: 'Aynı e-postaya sahip Google hesabınızı bağlayarak sonraki girişlerde Google butonunu kullanabilirsiniz.',
  });
  assert.deepEqual(getGoogleAccountLinkView(true), {
    linked: true,
    title: 'Google hesabı bağlı',
    description: 'Bu üyelikte Google ile giriş yapabilirsiniz.',
  });
});

test('keeps approved account-link errors and hides unexpected technical details', () => {
  assert.equal(
    getGoogleLinkErrorMessage(new Error('Bu Google hesabı başka bir üyeliğe bağlı.')),
    'Bu Google hesabı başka bir üyeliğe bağlı.',
  );
  assert.equal(
    getGoogleLinkErrorMessage(new TypeError('fetch failed: ECONNRESET cms.internal')),
    'Google hesabı bağlanamadı. Lütfen tekrar deneyin.',
  );
  assert.equal(
    getGoogleLinkErrorMessage('private upstream detail'),
    'Google hesabı bağlanamadı. Lütfen tekrar deneyin.',
  );
});
