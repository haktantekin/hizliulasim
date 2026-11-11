import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransitItinerary, TransitMode } from './contracts.ts';
import { buildTimelineItems, getModePresentation } from './presentation.ts';

const modes = [
  ['walking', 'Yürüme', '#6b7280', 'footprints'],
  ['bus', 'Otobüs', '#f59e0b', 'bus'],
  ['metro', 'Metro', '#dc2626', 'train-front'],
  ['tram', 'Tramvay', '#e11d48', 'tram-front'],
  ['rail', 'Tren', '#881337', 'train-track'],
  ['ferry', 'Vapur', '#2563eb', 'ship'],
  ['funicular', 'Füniküler', '#be123c', 'cable-car'],
  ['minibus', 'Minibüs', '#7c3aed', 'van'],
] as const satisfies readonly [TransitMode, string, string, string][];

test('each transit mode has a stable Turkish label, map color and icon', () => {
  for (const [mode, label, color, icon] of modes) {
    assert.deepEqual(getModePresentation(mode), { label, color, icon }, mode);
  }
});

const boardUrl = 'https://hizliulasim.com/otobus-duraklari/carsi-123456';
const itinerary: TransitItinerary = {
  durationMinutes: 24, walkingMinutes: 11, transferCount: 0, departureTime: '10:00', arrivalTime: '10:24',
  metadata: {
    dataVersion: 'fixture_v1', generatedAt: '2026-11-10T07:00:00Z', serviceDate: '2026-11-10',
    approximateWalking: true, geometryQuality: 'approximate',
  },
  keyPoints: [
    { role: 'origin', name: 'Başlangıç', coordinate: [41.0001, 29] },
    { role: 'board', name: 'Çarşı', coordinate: [41, 29.01], contentLink: { title: 'Çarşı Durağı', canonicalUrl: boardUrl } },
    { role: 'alight', name: 'İskele', coordinate: [41.02, 29.02] },
    { role: 'destination', name: 'Hedef', coordinate: [41.0201, 29.03] },
  ],
  steps: [
    {
      kind: 'walk', mode: 'walking', durationMinutes: 7, distanceMeters: 560,
      departureTime: '10:00', arrivalTime: '10:07', geometryQuality: 'approximate',
      geometry: [[41.0001, 29], [41, 29.01]],
    },
    {
      kind: 'ride', mode: 'bus', lineCode: '25G', color: '#f59e0b', stopCount: 4, durationMinutes: 10, distanceMeters: 2300,
      departureTime: '10:10', arrivalTime: '10:20', geometryQuality: 'exact',
      geometry: [[41, 29.01], [41.02, 29.02]],
      board: {
        role: 'board', name: 'Çarşı', coordinate: [41, 29.01],
        contentLink: { title: 'Çarşı Durağı', canonicalUrl: boardUrl },
      },
      alight: { role: 'alight', name: 'İskele', coordinate: [41.02, 29.02], code: '654321' },
    },
    {
      kind: 'walk', mode: 'walking', durationMinutes: 4, distanceMeters: 320,
      departureTime: '10:20', arrivalTime: '10:24', geometryQuality: 'approximate',
      geometry: [[41.02, 29.02], [41.0201, 29.03]],
    },
  ],
};

test('produces one walk item per walk and only boarding and alighting items for a ride', () => {
  assert.deepEqual(buildTimelineItems(itinerary), [
    { kind: 'walk', mode: 'walking', stepIndex: 0, durationMinutes: 7 },
    { kind: 'board', mode: 'bus', stepIndex: 1, lineCode: '25G', stop: { name: 'Çarşı', href: boardUrl } },
    { kind: 'alight', mode: 'bus', stepIndex: 1, stop: { name: 'İskele' } },
    { kind: 'walk', mode: 'walking', stepIndex: 2, durationMinutes: 4 },
  ]);
});

test('uses plain stop names for external or invalid canonical URLs', () => {
  const step = itinerary.steps[1];
  assert.equal(step.kind, 'ride');
  for (const canonicalUrl of [
    'https://elsewhere.example/durak', '//hizliulasim.com/durak', '/\\elsewhere.example/durak',
    'javascript:alert(1)', 'https://hizliulasim.com@elsewhere.example/durak',
  ]) {
    const items = buildTimelineItems({
      ...itinerary,
      steps: [{ ...step, board: { ...step.board, contentLink: { title: 'Çarşı Durağı', canonicalUrl } } }],
    });
    assert.deepEqual(items[0], {
      kind: 'board', mode: 'bus', stepIndex: 0, lineCode: '25G', stop: { name: 'Çarşı' },
    }, canonicalUrl);
  }
});
