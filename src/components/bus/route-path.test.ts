import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IETTDurakDetay } from '../../types/iett.ts';
import type { IettStaticPath } from '../../lib/iett-static/contracts.ts';
import { selectIettRoutePath } from './route-path.ts';

const stops: IETTDurakDetay[] = [
  { HATKODU: '1', YON: 'D', YON_ADI: 'Gidiş', SIRANO: 2, DURAKKODU: '2', DURAKADI: 'İkinci', XKOORDINATI: 29.02, YKOORDINATI: 41.02, DURAKTIPI: '', ISLETMEBOLGE: '', ISLETMEALTBOLGE: '', ILCEADI: '' },
  { HATKODU: '1', YON: 'D', YON_ADI: 'Gidiş', SIRANO: 1, DURAKKODU: '1', DURAKADI: 'Birinci', XKOORDINATI: 29.01, YKOORDINATI: 41.01, DURAKTIPI: '', ISLETMEBOLGE: '', ISLETMEALTBOLGE: '', ILCEADI: '' },
];

test('selects the stored path for the active direction', () => {
  const paths: IettStaticPath[] = [
    { direction: 'G', quality: 'exact', coordinates: [[41.2, 29.2], [41.3, 29.3]] },
    { direction: 'D', quality: 'exact', coordinates: [[41.1, 29.1], [41.15, 29.15]] },
  ];
  assert.deepEqual(selectIettRoutePath(paths, stops, 'D'), {
    direction: 'D', quality: 'exact', coordinates: [[41.1, 29.1], [41.15, 29.15]],
  });
});

test('falls back only to ordered stored stops and marks the geometry approximate', () => {
  assert.deepEqual(selectIettRoutePath([], stops, 'D'), {
    direction: 'D', quality: 'approximate', coordinates: [[41.01, 29.01], [41.02, 29.02]],
  });
  assert.equal(selectIettRoutePath([], stops.slice(0, 1), 'D'), null);
  assert.equal(selectIettRoutePath([], stops, 'G'), null);
});
