import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  IettAlertsUnavailableError,
  getIettAlerts,
  sortIettAlertsByRecency,
} from './iett-alerts.ts';
import type { IETTDuyuru } from '../types/iett.ts';

function alert(lineCode: string, time: string, changes: Partial<IETTDuyuru> = {}): IETTDuyuru {
  return {
    HATKODU: lineCode,
    HAT: `${lineCode} HATTI`,
    TIP: 'Günlük',
    GUNCELLEME_SAATI: `Kayit Saati: ${time}`,
    MESAJ: `${lineCode} için güzergâh değişikliği.`,
    ...changes,
  };
}

function cmsResponse(data: unknown, ok = true): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  }));
}

test('validates and repairs the CMS alert envelope before exposing it', async () => {
  const result = await getIettAlerts({}, {
    fetcher: () => cmsResponse({
      data: [alert('11G', '16:07', {
        HAT: 'NECÄ°P FAZIL METRO - YENÄ°DOÄžAN',
        MESAJ: '  Yol   çalışması nedeniyle\n güzergâh değişti.  ',
      })],
      status: 'current',
      fetchedAt: '2026-11-13T13:10:00Z',
    }),
    now: () => new Date('2026-11-13T13:15:00Z'),
  });

  assert.equal(result.data[0].HAT, 'NECİP FAZIL METRO - YENİDOĞAN');
  assert.equal(result.data[0].MESAJ, 'Yol çalışması nedeniyle güzergâh değişti.');
  assert.deepEqual(result.metadata, {
    source: 'current',
    fetchedAt: '2026-11-13T13:10:00Z',
  });
});

test('sorts update times by recency across Istanbul midnight and keeps unparseable ties stable', () => {
  const sorted = sortIettAlertsByRecency([
    alert('OLD', '23:40'),
    alert('UNKNOWN-1', '10:00', { GUNCELLEME_SAATI: 'Bilinmiyor' }),
    alert('NEW', '00:05'),
    alert('UNKNOWN-2', '10:00', { GUNCELLEME_SAATI: 'Bilinmiyor' }),
  ], 10);

  assert.deepEqual(sorted.map((item) => item.HATKODU), ['NEW', 'OLD', 'UNKNOWN-1', 'UNKNOWN-2']);
});

test('uses exact normalized line matching and applies the requested limit after sorting', async () => {
  const result = await getIettAlerts({ lineCode: ' 1 ', limit: 1 }, {
    fetcher: () => cmsResponse({
      data: [alert('10B', '16:20'), alert('1', '15:10'), alert('1', '16:10')],
      status: 'stale',
      fetchedAt: '2026-11-13T13:00:00Z',
    }),
    now: () => new Date('2026-11-13T13:30:00Z'),
  });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].HATKODU, '1');
  assert.equal(result.data[0].GUNCELLEME_SAATI, 'Kayit Saati: 16:10');
  assert.equal(result.metadata.source, 'stale');
});

test('deduplicates a multi-line announcement globally but preserves exact line filtering', async () => {
  const shared = {
    GUNCELLEME_SAATI: '10 Kasım 2026',
    MESAJ: '78E, 78F ve 78K Hatlarımız Hakkında',
  };
  const payload = {
    data: [alert('78E', '10:00', shared), alert('78F', '10:00', shared), alert('78K', '10:00', shared)],
    status: 'current',
    fetchedAt: '2026-11-13T13:00:00Z',
  };

  const globalResult = await getIettAlerts({}, { fetcher: () => cmsResponse(payload) });
  const lineResult = await getIettAlerts({ lineCode: '78F' }, { fetcher: () => cmsResponse(payload) });

  assert.deepEqual(globalResult.data.map((item) => item.HATKODU), ['78E']);
  assert.deepEqual(lineResult.data.map((item) => item.HATKODU), ['78F']);
});

test('uses a versioned default CMS URL so an old edge-cached 404 is not reused', async () => {
  let requested = '';
  await getIettAlerts({}, {
    fetcher: (input) => {
      requested = String(input);
      return cmsResponse({ data: [], status: 'current', fetchedAt: '2026-11-13T13:00:00Z' });
    },
  });

  assert.equal(new URL(requested).searchParams.get('consumer'), 'web-v2');
});

test('does not broaden an invalid line-code filter to every alert', async () => {
  const result = await getIettAlerts({ lineCode: '../1' }, {
    fetcher: () => cmsResponse({
      data: [alert('1', '16:10'), alert('10B', '16:20')],
      status: 'current',
      fetchedAt: '2026-11-13T13:00:00Z',
    }),
  });

  assert.deepEqual(result.data, []);
});

test('rejects an upstream error and a malformed CMS payload without leaking its body', async () => {
  await assert.rejects(
    getIettAlerts({}, { fetcher: () => cmsResponse({ secret: 'upstream body' }, false) }),
    (error: unknown) => error instanceof IettAlertsUnavailableError && !error.message.includes('secret'),
  );
  await assert.rejects(
    getIettAlerts({}, { fetcher: () => cmsResponse({ data: [alert('../1', '16:00')], status: 'current', fetchedAt: 'bad' }) }),
    IettAlertsUnavailableError,
  );
});
