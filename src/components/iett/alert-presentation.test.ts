import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildIettLineAlertsEndpoint,
  buildIettLineHref,
  extractIettAlertTime,
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

test('accepts only the exact public alert payload shape', () => {
  const valid = {
    HATKODU: '11G',
    HAT: 'NECİP FAZIL METRO - YENİDOĞAN',
    TIP: 'Günlük',
    GUNCELLEME_SAATI: 'Kayıt Saati: 16:07',
    MESAJ: 'Yol çalışması nedeniyle güzergâh değişti.',
  };

  assert.deepEqual(parseIettAlertList([valid]), [valid]);
  assert.equal(parseIettAlertList([{ ...valid, extra: 'unexpected' }]), null);
  assert.equal(parseIettAlertList([{ ...valid, HATKODU: 11 }]), null);
  assert.equal(parseIettAlertList({ data: [valid] }), null);
});
