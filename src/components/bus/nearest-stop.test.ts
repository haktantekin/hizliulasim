import assert from 'node:assert/strict';
import test from 'node:test';
import type { IETTDurakDetay } from '@/types/iett';
import { findNearestStop } from './nearest-stop.ts';

function stop(code: string, direction: string, lat: number, lng: number): IETTDurakDetay {
  return {
    HATKODU: '1',
    YON: direction,
    YON_ADI: direction === 'D' ? 'Gidiş' : 'Dönüş',
    SIRANO: Number(code),
    DURAKKODU: code,
    DURAKADI: `Durak ${code}`,
    XKOORDINATI: lng,
    YKOORDINATI: lat,
    DURAKTIPI: '',
    ISLETMEBOLGE: '',
    ISLETMEALTBOLGE: '',
    ILCEADI: 'İstanbul',
  };
}

test('nearest stop uses static coordinates for the selected direction', () => {
  const result = findNearestStop(
    [
      stop('1', 'D', 41.0005, 29.0005),
      stop('2', 'D', 41.02, 29.02),
      stop('3', 'G', 41.0001, 29.0001),
    ],
    'D',
    { lat: 41, lng: 29 },
  );

  assert.equal(result?.stop.DURAKKODU, '1');
  assert.ok(result && result.distance > 60 && result.distance < 80);
});

test('nearest stop ignores stops with invalid coordinates', () => {
  const result = findNearestStop(
    [stop('1', 'D', Number.NaN, 29), stop('2', 'D', 0, 0)],
    'D',
    { lat: 41, lng: 29 },
  );

  assert.equal(result, null);
});
