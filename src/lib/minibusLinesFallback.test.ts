import assert from 'node:assert/strict';
import test from 'node:test';

import * as minibusDataModule from './minibusData.ts';

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
