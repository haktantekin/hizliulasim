import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildIettAlertDestination,
  buildIettLineAlertsEndpoint,
  buildIettLineHref,
  extractIettAlertTime,
  getIettAlertDetail,
  parseIettAlertList,
  summarizeIettAlertMessage,
} from './alert-presentation.ts';

test('extracts a valid update time without exposing the source label', () => {
  assert.equal(extractIettAlertTime('Kayıt Saati: 16:07'), '16:07');
  assert.equal(extractIettAlertTime('Bilinmiyor'), null);
});

test('builds an encoded bus-line link from a safe normalized line code', () => {
  assert.equal(buildIettLineHref(' 11ÜS '), '/otobus-hatlari/11%C3%BCs');
  assert.equal(buildIettLineHref('GENEL'), null);
  assert.equal(buildIettLineHref('../1'), null);
});

test('builds a line-specific alert endpoint without widening an invalid query', () => {
  assert.equal(buildIettLineAlertsEndpoint(' 11ÜS '), '/api/iett/duyurular?hatKodu=11%C3%9CS&limit=20');
  assert.equal(buildIettLineAlertsEndpoint('../1'), null);
});

test('compacts and truncates long alert messages for the global bar', () => {
  const message = `  ${'Güzergâh değişikliği nedeniyle durak kullanılamıyor. '.repeat(5)} `;
  const summary = summarizeIettAlertMessage(message, 80);

  assert.equal(summary.length <= 80, true);
  assert.equal(summary.endsWith('…'), true);
  assert.equal(summary.includes('  '), false);
});

test('shows the official detail only when it adds information below the title', () => {
  const base = {
    HATKODU: '78F',
    HAT: '78E, 78F ve 78K Hatlarımız Hakkında',
    TIP: 'İETT Duyurusu',
    GUNCELLEME_SAATI: '10 Kasım 2026',
    MESAJ: '78E, 78F ve 78K Hatlarımız Hakkında',
    KAYNAK_URL: 'https://www.iett.istanbul/Announcement/Detail/3350',
  };

  assert.equal(getIettAlertDetail(base), null);
  assert.equal(getIettAlertDetail({
    ...base,
    MESAJ: 'Başakşehir bölgesinde bazı duraklar hizmet dışı bırakılmıştır.',
  }), 'Başakşehir bölgesinde bazı duraklar hizmet dışı bırakılmıştır.');
});

test('prefers a local bus line and otherwise permits only an official IETT detail link', () => {
  const base = {
    HATKODU: '78F',
    HAT: '78F Hattımız Hakkında',
    TIP: 'İETT Duyurusu',
    GUNCELLEME_SAATI: '10 Kasım 2026',
    MESAJ: '78F Hattımız Hakkında',
    KAYNAK_URL: 'https://www.iett.istanbul/Announcement/Detail/3350',
  };

  assert.deepEqual(buildIettAlertDestination(base), {
    href: '/otobus-hatlari/78f',
    external: false,
  });
  assert.deepEqual(buildIettAlertDestination({ ...base, HATKODU: 'GENEL' }), {
    href: 'https://www.iett.istanbul/Announcement/Detail/3350',
    external: true,
  });
  assert.equal(buildIettAlertDestination({
    ...base,
    HATKODU: 'GENEL',
    KAYNAK_URL: 'https://iett.example/Announcement/Detail/3350',
  }), null);
});

test('accepts only the exact public alert payload shape', () => {
  const valid = {
    HATKODU: '11G',
    HAT: 'NECİP FAZIL METRO - YENİDOĞAN',
    TIP: 'Günlük',
    GUNCELLEME_SAATI: 'Kayıt Saati: 16:07',
    MESAJ: 'Yol çalışması nedeniyle güzergâh değişti.',
    KAYNAK_URL: 'https://www.iett.istanbul/Announcement/Detail/3350',
  };

  assert.deepEqual(parseIettAlertList([valid]), [valid]);
  assert.equal(parseIettAlertList([{ ...valid, extra: 'unexpected' }]), null);
  assert.equal(parseIettAlertList([{ ...valid, HATKODU: 11 }]), null);
  assert.equal(parseIettAlertList({ data: [valid] }), null);
});
