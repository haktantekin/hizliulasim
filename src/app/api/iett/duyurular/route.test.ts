import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IettAlertsResult } from '../../../../services/iett-alerts.ts';
import { createIettAlertsGet } from './handler.ts';

const result: IettAlertsResult = {
  data: [{
    HATKODU: '1', HAT: 'KİRAZLITEPE - KADIKÖY', TIP: 'Günlük',
    GUNCELLEME_SAATI: 'Kayit Saati: 16:10', MESAJ: 'Güzergâh değişikliği.',
  }],
  metadata: { source: 'stale', fetchedAt: '2026-11-13T13:00:00Z' },
};

test('returns public alert data with cache and freshness headers', async () => {
  let received: unknown;
  const GET = createIettAlertsGet(async (query) => { received = query; return result; });
  const response = await GET(new Request('http://localhost/api/iett/duyurular?hatKodu=1&limit=5'));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result.data);
  assert.deepEqual(received, { lineCode: '1', limit: 5 });
  assert.equal(response.headers.get('x-hizliulasim-alert-source'), 'stale');
  assert.match(response.headers.get('cache-control') ?? '', /stale-while-revalidate/);
});

test('rejects invalid query values before loading CMS alerts', async () => {
  let calls = 0;
  const GET = createIettAlertsGet(async () => { calls++; return result; });
  const response = await GET(new Request('http://localhost/api/iett/duyurular?hatKodu=../1&limit=100'));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test('maps unavailable CMS alerts to a sanitized 503 response', async () => {
  const GET = createIettAlertsGet(async () => { throw new Error('private upstream response'); });
  const response = await GET(new Request('http://localhost/api/iett/duyurular'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'İETT uyarıları şu anda kullanılamıyor' });
});
