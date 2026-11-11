import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransitItinerary, TransitMode } from './contracts.ts';
import { buildTimelineItems, createPlannerState, getModePresentation, reducePlanner } from './presentation.ts';

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

const origin = { name: 'Beşiktaş', latitude: 41.04, longitude: 29.01 };
const destination = { name: 'Kadıköy', latitude: 40.99, longitude: 29.03 };
const prediction = { id: 'besiktas', description: 'Beşiktaş, İstanbul' };

test('starts a route only when both location fields have selected coordinates', () => {
  let state = createPlannerState({ destination });
  state = reducePlanner(state, { type: 'edit-location', role: 'origin', query: 'Beş' });
  assert.equal(state.route.kind, 'idle');
  const search = state.origin.lookup;
  assert.equal(search.kind, 'search');

  state = reducePlanner(state, { type: 'suggestions', role: 'origin', id: search.id, predictions: [prediction] });
  state = reducePlanner(state, { type: 'choose-place', role: 'origin', placeId: 'besiktas' });
  const details = state.origin.lookup;
  assert.equal(details.kind, 'details');
  assert.equal(state.route.kind, 'idle');

  state = reducePlanner(state, { type: 'resolve-location', role: 'origin', id: details.id, value: origin });
  assert.deepEqual(state.origin.value, origin);
  assert.equal(state.route.kind, 'loading');
  assert.deepEqual(state.route.origin, origin);
  assert.deepEqual(state.route.destination, destination);

  state = reducePlanner(state, { type: 'edit-location', role: 'destination', query: '' });
  assert.equal(state.destination.value, null);
  assert.equal(state.route.kind, 'idle');
});

test('preserves the locked destination through edits, geolocation, and swapping', () => {
  const state = createPlannerState({ origin, destination: origin }, destination);
  assert.deepEqual(state.destination.value, destination);
  assert.equal(reducePlanner(state, { type: 'edit-location', role: 'destination', query: 'Taksim' }), state);
  assert.equal(reducePlanner(state, { type: 'locate', role: 'destination' }), state);
  assert.equal(reducePlanner(state, { type: 'swap-locations' }), state);
});

test('rejects non-finite coordinates from an initial state or a location fix', () => {
  const invalid = { ...origin, latitude: Number.NaN };
  const initial = createPlannerState({ origin: invalid, destination });
  assert.equal(initial.origin.value, null);
  const locating = reducePlanner(initial, { type: 'locate', role: 'origin' });
  assert.equal(locating.origin.lookup.kind, 'geolocation');
  const state = reducePlanner(locating, {
    type: 'resolve-location', role: 'origin', id: locating.origin.lookup.id, value: invalid,
  });
  assert.equal(state.origin.value, null);
  assert.equal(state.origin.lookup.kind, 'error');
  assert.equal(state.route.kind, 'idle');
});

test('swaps both selected locations and starts a new request in the reversed direction', () => {
  const state = createPlannerState({ origin, destination });
  const swapped = reducePlanner(state, { type: 'swap-locations' });
  assert.equal(state.route.kind, 'loading');
  assert.equal(swapped.route.kind, 'loading');
  assert.notEqual(swapped.route.id, state.route.id);
  assert.deepEqual(swapped.route.origin, destination);
  assert.deepEqual(swapped.route.destination, origin);
  assert.equal(swapped.origin.query, 'Kadıköy');
  assert.equal(swapped.destination.query, 'Beşiktaş');
});

test('keeps manual search available after denied geolocation and accepts a later coordinate fix', () => {
  let state = reducePlanner(createPlannerState({ destination }), { type: 'locate', role: 'origin' });
  const pending = state.origin.lookup;
  assert.equal(pending.kind, 'geolocation');
  state = reducePlanner(state, { type: 'lookup-failed', role: 'origin', id: pending.id, message: 'Konum izni verilmedi.' });
  assert.deepEqual(state.origin.lookup, { kind: 'error', message: 'Konum izni verilmedi.' });
  assert.equal(state.route.kind, 'idle');

  state = reducePlanner(state, { type: 'edit-location', role: 'origin', query: 'Beş' });
  assert.equal(state.origin.lookup.kind, 'search');
  state = reducePlanner(state, { type: 'locate', role: 'origin' });
  const retry = state.origin.lookup;
  assert.equal(retry.kind, 'geolocation');
  state = reducePlanner(state, { type: 'resolve-location', role: 'origin', id: retry.id, value: origin });
  assert.deepEqual(state.origin.value, origin);
  assert.equal(state.origin.lookup.kind, 'idle');
  assert.equal(state.route.kind, 'loading');
});

test('discards autocomplete, place details, and geolocation responses superseded by a typed location', () => {
  const edit = (state: ReturnType<typeof createPlannerState>, query: string) =>
    reducePlanner(state, { type: 'edit-location', role: 'origin', query });
  const first = edit(createPlannerState(), 'Be');
  assert.equal(first.origin.lookup.kind, 'search');
  const second = edit(first, 'Beş');
  assert.equal(second.origin.lookup.kind, 'search');
  assert.equal(reducePlanner(second, {
    type: 'suggestions', role: 'origin', id: first.origin.lookup.id, predictions: [prediction],
  }), second);

  const suggested = reducePlanner(second, {
    type: 'suggestions', role: 'origin', id: second.origin.lookup.id, predictions: [prediction],
  });
  const chosen = reducePlanner(suggested, { type: 'choose-place', role: 'origin', placeId: 'besiktas' });
  assert.equal(chosen.origin.lookup.kind, 'details');
  const locating = reducePlanner(chosen, { type: 'locate', role: 'origin' });
  assert.equal(locating.origin.lookup.kind, 'geolocation');
  const typed = edit(locating, 'Taksim');
  for (const id of [chosen.origin.lookup.id, locating.origin.lookup.id]) {
    assert.equal(reducePlanner(typed, { type: 'resolve-location', role: 'origin', id, value: origin }), typed);
    assert.equal(reducePlanner(typed, { type: 'lookup-failed', role: 'origin', id, message: 'Eski hata' }), typed);
  }
});

const departureAt = '2026-11-10T07:00:00.000Z';
const alternatives = [itinerary, { ...itinerary, durationMinutes: 28 }];

test('rejects a cancelled route response and retries with a new request ID', () => {
  const initial = createPlannerState({ origin, destination });
  assert.equal(initial.route.kind, 'loading');
  const id = initial.route.id;
  const cancelled = reducePlanner(initial, { type: 'cancel-route' });
  assert.equal(cancelled.route.kind, 'idle');
  assert.equal(reducePlanner(cancelled, { type: 'route-succeeded', id, departureAt, alternatives }), cancelled);

  const retry = reducePlanner(cancelled, { type: 'retry-route' });
  assert.equal(retry.route.kind, 'loading');
  assert.notEqual(retry.route.id, id);
  assert.equal(reducePlanner(retry, { type: 'route-failed', id, message: 'Eski hata' }), retry);
});

test('changing route options ignores earlier responses and keeps the latest request values', () => {
  const initial = createPlannerState({ origin, destination });
  assert.equal(initial.route.kind, 'loading');
  const timed = reducePlanner(initial, { type: 'set-departure', departureAt });
  const preferred = reducePlanner(timed, { type: 'set-preference', preference: 'less-walking' });
  assert.equal(timed.route.kind, 'loading');
  assert.equal(preferred.route.kind, 'loading');
  assert.equal(preferred.route.departureAt, departureAt);
  assert.equal(preferred.route.preference, 'less-walking');
  for (const id of [initial.route.id, timed.route.id]) {
    assert.equal(reducePlanner(preferred, { type: 'route-succeeded', id, departureAt, alternatives }), preferred);
  }
});

test('exposes a current route error and clears it when retrying', () => {
  const initial = createPlannerState({ origin, destination });
  assert.equal(initial.route.kind, 'loading');
  const failed = reducePlanner(initial, {
    type: 'route-failed', id: initial.route.id, message: 'Toplu taşıma verileri şu anda kullanılamıyor.',
  });
  assert.deepEqual(failed.route, {
    kind: 'error', message: 'Toplu taşıma verileri şu anda kullanılamıyor.',
  });
  const retry = reducePlanner(failed, { type: 'retry-route' });
  assert.equal(retry.route.kind, 'loading');
  assert.notEqual(retry.route.id, initial.route.id);
});

test('restores an available alternative and ignores invalid selection indexes', () => {
  const initial = createPlannerState({ origin, destination, selectedAlternative: 1 });
  assert.equal(initial.route.kind, 'loading');
  const result = reducePlanner(initial, { type: 'route-succeeded', id: initial.route.id, departureAt, alternatives });
  assert.equal(result.route.kind, 'success');
  assert.equal(result.route.selectedAlternative, 1);
  assert.equal(reducePlanner(result, { type: 'select-alternative', index: 2 }), result);
  const first = reducePlanner(result, { type: 'select-alternative', index: 0 });
  assert.equal(first.route.kind, 'success');
  assert.equal(first.route.selectedAlternative, 0);

  const fewer = reducePlanner(initial, { type: 'route-succeeded', id: initial.route.id, departureAt, alternatives: [itinerary] });
  assert.equal(fewer.route.kind, 'success');
  assert.equal(fewer.route.selectedAlternative, 0);
});
