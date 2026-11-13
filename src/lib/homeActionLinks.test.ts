import assert from 'node:assert/strict';
import test from 'node:test';

import { homeGuideItems, homeServiceItems } from './homeActionLinks.ts';

test('ana sayfa rehber bağlantılarını üstte, günlük servis bağlantılarını içerik akışında gruplar', () => {
  assert.deepEqual(homeGuideItems.map((item) => item.href), [
    '/ulasim-rehberi',
    '/minibus-hatlari',
  ]);
  assert.deepEqual(homeServiceItems.map((item) => item.href), [
    '/rayli-sistemler',
    '/otopark-ucretleri',
    '/sarj-istasyonlari',
    '/yol-tarifi',
  ]);
});
