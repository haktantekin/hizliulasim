import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransitItinerary, TransitMode } from './contracts.ts';
import { buildTransitMapModel } from './map-model.ts';
import * as presentation from './presentation.ts';

const {
  buildTimelineItems, createPlannerState, getCurrentDepartureAt,
  getCurrentLocationButtonVisibility, getModePresentation, getSelectableTravelModes, getTransitCoverageNotice, getTravelModeLabel,
  getUsedTransitModes, isPlannerLocation, reducePlanner,
} = presentation;

const modes = [
  ['walking', 'Yürüme', '#6b7280', 'footprints'],
  ['bus', 'Otobüs', '#f59e0b', 'bus'],
  ['metro', 'Metro', '#dc2626', 'train-front'],
  ['tram', 'Tramvay', '#e11d48', 'tram-front'],
  ['rail', 'Tren', '#881337', 'train-track'],
  ['ferry', 'Vapur', '#2563eb', 'ship'],
  ['funicular', 'Füniküler', '#be123c', 'cable-car'],
  ['cable_car', 'Teleferik', '#9f1239', 'cable-car'],
  ['minibus', 'Minibüs', '#7c3aed', 'van'],
] as const satisfies readonly [TransitMode, string, string, string][];

test('each transit mode has a stable Turkish label, map color and icon', () => {
  for (const [mode, label, color, icon] of modes) {
    assert.deepEqual(getModePresentation(mode), { label, color, icon }, mode);
  }
});

test('labels the mixed public filter as Tümü while preserving its transit value', () => {
  assert.equal(getTravelModeLabel('transit'), 'Tümü');
  assert.equal(getTravelModeLabel('walking'), 'Yürüyerek');
  assert.equal(getTravelModeLabel('bus'), 'Otobüs');
  assert.equal(getTravelModeLabel('metro'), 'Metro');
});

test('offers only travel modes backed by the active public snapshot', () => {
  assert.deepEqual(getSelectableTravelModes(), ['transit', 'walking', 'bus']);
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
    { kind: 'walk', mode: 'walking', stepIndex: 0, durationMinutes: 7, instruction: '7 dk yürü', time: '10:00' },
    {
      kind: 'board', mode: 'bus', stepIndex: 1, lineCode: '25G', vehicle: 'otobüsüne', stop: { name: 'Çarşı', href: boardUrl },
      action: 'durağında bin', time: '10:10', stopCountLabel: '4 durak',
    },
    { kind: 'alight', mode: 'bus', stepIndex: 1, stop: { name: 'İskele' }, action: 'durağında in', time: '10:20' },
    { kind: 'walk', mode: 'walking', stepIndex: 2, durationMinutes: 4, instruction: '4 dk yürü', time: '10:20' },
  ]);
});

test('uses Turkish vehicle suffixes and singular stop count across transfers', () => {
  const bus = itinerary.steps[1];
  assert.equal(bus.kind, 'ride');
  const modes = [
    ['bus', 'otobüsüne'], ['metro', 'metrosuna'], ['tram', 'tramvayına'], ['rail', 'trenine'],
    ['ferry', 'vapuruna'], ['funicular', 'fünikülerine'], ['cable_car', 'teleferiğine'], ['minibus', 'minibüsüne'],
  ] as const;
  for (const [mode, vehicle] of modes) {
    const items = buildTimelineItems({
      ...itinerary,
      transferCount: 1,
      steps: [bus, {
        ...bus, mode, lineCode: 'B2', stopCount: 1, departureTime: '10:22', arrivalTime: '10:28',
        board: { ...bus.alight, role: 'board' },
        alight: { role: 'alight', name: 'Merkez', coordinate: [41.025, 29.025] },
      }],
    });
    assert.deepEqual(items.slice(2), [
      {
        kind: 'board', mode, stepIndex: 1, lineCode: 'B2', vehicle, stop: { name: 'İskele' },
        action: 'durağında bin', time: '10:22', stopCountLabel: '1 durak',
      },
      { kind: 'alight', mode, stepIndex: 1, stop: { name: 'Merkez' }, action: 'durağında in', time: '10:28' },
    ]);
  }
});

test('summarizes used modes and explains stale, estimated and v1 coverage', () => {
  const bus = itinerary.steps[1];
  assert.equal(bus.kind, 'ride');
  const mixed = {
    ...itinerary,
    steps: [bus, { ...bus, mode: 'metro' as const, estimatedDuration: true }],
  };
  assert.deepEqual(getUsedTransitModes(mixed), ['bus', 'metro']);
  const coverage = [
    { provider: 'iett', modes: ['bus'], retrievedAt: '2026-11-10T12:00:00Z', status: 'current', sourceSha256: '1'.repeat(64) },
    { provider: 'metro', modes: ['metro'], retrievedAt: '2026-11-10T12:00:00Z', status: 'stale', sourceSha256: '2'.repeat(64) },
    { provider: 'tcdd', modes: ['rail'], retrievedAt: '2026-11-10T12:00:00Z', status: 'current', sourceSha256: '3'.repeat(64) },
    { provider: 'sehirhatlari', modes: ['ferry'], retrievedAt: '2026-11-10T12:00:00Z', status: 'current', sourceSha256: '4'.repeat(64) },
    { provider: 'minibus', modes: ['minibus'], retrievedAt: '2026-11-10T12:00:00Z', status: 'current', sourceSha256: '5'.repeat(64) },
  ] as const;
  assert.equal(getTransitCoverageNotice(mixed, coverage),
    'Metro İstanbul için son doğrulanmış paket kullanılıyor. Bazı yolculuk süreleri tahminidir.');
  assert.equal(getTransitCoverageNotice(itinerary), 'Bu rota mevcut İETT otobüs verisiyle hesaplandı.');
});

test('summarizes duration, walking, transfers and scheduled times for each alternative', () => {
  const { getItinerarySummary } = presentation;
  assert.equal(typeof getItinerarySummary, 'function');
  assert.deepEqual(getItinerarySummary(itinerary), {
    duration: '24 dk', walking: '11 dk yürüme', transfers: 'Aktarmasız', departureTime: '10:00', arrivalTime: '10:24',
  });
  assert.equal(getItinerarySummary({ ...itinerary, transferCount: 1 }).transfers, '1 aktarma');
  assert.equal(getItinerarySummary({ ...itinerary, transferCount: 2 }).transfers, '2 aktarma');
});

test('uses plain stop names for external or invalid canonical URLs', () => {
  const step = itinerary.steps[1];
  assert.equal(step.kind, 'ride');
  for (const canonicalUrl of [
    'https://elsewhere.example/durak', '//hizliulasim.com/durak', '/\\elsewhere.example/durak',
    'javascript:alert(1)', 'https://hizliulasim.com@elsewhere.example/durak',
    'https://hizliulasim.com/otobus-duraklari/carsi', '/otobus-duraklari/%2Fcarsi-123456',
    '/otobus-duraklari/carsi-123456?redirect=/yol-tarifi',
    'https://hizliulasim.com/otobus-duraklari/beylerbeyi-219312',
    'https://hizliulasim.com/otobus-hatlari/25g',
  ]) {
    const items = buildTimelineItems({
      ...itinerary,
      steps: [{ ...step, board: { ...step.board, contentLink: { title: 'Çarşı Durağı', canonicalUrl } } }],
    });
    assert.equal(items[0].kind, 'board');
    assert.deepEqual(items[0].stop, { name: 'Çarşı' }, canonicalUrl);
  }
});

const origin = { name: 'Beşiktaş', latitude: 41.04, longitude: 29.01 };
const destination = { name: 'Kadıköy', latitude: 40.99, longitude: 29.03 };
const prediction = { id: 'besiktas', description: 'Beşiktaş, İstanbul' };
const departureAt = '2026-11-10T07:00:00.000Z';

function submit(state: ReturnType<typeof createPlannerState>, instant = departureAt) {
  return reducePlanner(state, { type: 'submit-route', departureAt: instant });
}

test('turns the now button clock into an explicit departure instant', () => {
  assert.equal(getCurrentDepartureAt(new Date('2026-11-12T08:34:56.789Z')), '2026-11-12T08:34:56.789Z');
});

test('hides the other current-location button from click through resolution and restores it after editing', () => {
  let state = createPlannerState();
  assert.deepEqual(
    getCurrentLocationButtonVisibility('full', state.origin, state.destination),
    { origin: true, destination: true },
  );

  state = reducePlanner(state, { type: 'locate', role: 'origin' });
  assert.equal(state.origin.usesCurrentLocation, true);
  assert.deepEqual(
    getCurrentLocationButtonVisibility('full', state.origin, state.destination),
    { origin: true, destination: false },
  );

  const lookup = state.origin.lookup;
  assert.equal(lookup.kind, 'geolocation');
  state = reducePlanner(state, {
    type: 'resolve-location', role: 'origin', id: lookup.id,
    value: { name: 'Konumum', latitude: 41.01, longitude: 29.01 },
  });
  assert.deepEqual(
    getCurrentLocationButtonVisibility('full', state.origin, state.destination),
    { origin: true, destination: false },
  );

  state = reducePlanner(state, { type: 'edit-location', role: 'origin', query: 'Beşiktaş' });
  assert.deepEqual(
    getCurrentLocationButtonVisibility('full', state.origin, state.destination),
    { origin: true, destination: true },
  );
});

test('starts a route only after both locations are selected and the user submits', () => {
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
  assert.equal(state.route.kind, 'idle');

  state = reducePlanner(state, { type: 'submit-route', departureAt });
  assert.equal(state.route.kind, 'loading');
  assert.deepEqual(state.route.origin, origin);
  assert.deepEqual(state.route.destination, destination);
  assert.equal(state.route.departureAt, departureAt);

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

test('accepts the inclusive API bounds and suppresses a fixed detail destination outside them', () => {
  for (const [latitude, longitude] of [[39.5, 26], [42.5, 31]]) {
    assert.equal(isPlannerLocation({ ...destination, latitude, longitude }), true);
  }
  for (const [latitude, longitude] of [[39.49, 29], [42.51, 29], [41, 25.99], [41, 31.01]]) {
    const fixed = { ...destination, latitude, longitude };
    assert.equal(isPlannerLocation(fixed), false);
    const state = createPlannerState({ origin, destination }, fixed);
    assert.equal(state.destination.value, null);
    assert.equal(state.route.kind, 'idle');
  }
});

test('keeps an out-of-area editable initial location unselected and shows coverage feedback', () => {
  const state = createPlannerState({ origin, destination: { ...destination, latitude: 38 } });
  assert.equal(state.destination.value, null);
  assert.equal(state.destination.lookup.kind, 'error');
  assert.match(state.destination.lookup.message, /rota arama alanının dışında/);
  assert.equal(state.route.kind, 'idle');
});

test('shows coverage feedback for an out-of-area position fix without routing', () => {
  const locating = reducePlanner(createPlannerState({ destination }), { type: 'locate', role: 'origin' });
  assert.equal(locating.origin.lookup.kind, 'geolocation');
  const state = reducePlanner(locating, {
    type: 'resolve-location', role: 'origin', id: locating.origin.lookup.id,
    value: { name: 'Konumum', latitude: 39.9, longitude: 32.8 },
  });
  assert.equal(state.origin.value, null);
  assert.equal(state.origin.lookup.kind, 'error');
  assert.match(state.origin.lookup.message, /rota arama alanının dışında/);
  assert.equal(state.route.kind, 'idle');
});

test('shows coverage feedback for an out-of-area Place result without routing', () => {
  const search = reducePlanner(createPlannerState({ origin }), { type: 'edit-location', role: 'destination', query: 'Ankara' });
  assert.equal(search.destination.lookup.kind, 'search');
  const suggested = reducePlanner(search, {
    type: 'suggestions', role: 'destination', id: search.destination.lookup.id,
    predictions: [{ id: 'ankara', description: 'Ankara' }],
  });
  const chosen = reducePlanner(suggested, { type: 'choose-place', role: 'destination', placeId: 'ankara' });
  assert.equal(chosen.destination.lookup.kind, 'details');
  const state = reducePlanner(chosen, {
    type: 'resolve-location', role: 'destination', id: chosen.destination.lookup.id,
    value: { name: 'Ankara', latitude: 39.9, longitude: 32.8 },
  });
  assert.equal(state.destination.value, null);
  assert.equal(state.destination.lookup.kind, 'error');
  assert.match(state.destination.lookup.message, /rota arama alanının dışında/);
  assert.equal(state.route.kind, 'idle');
});

test('swaps both selected locations without starting a request', () => {
  const state = createPlannerState({ origin, destination });
  const swapped = reducePlanner(state, { type: 'swap-locations' });
  assert.equal(state.route.kind, 'idle');
  assert.equal(swapped.route.kind, 'idle');
  assert.equal(swapped.origin.query, 'Kadıköy');
  assert.equal(swapped.destination.query, 'Beşiktaş');
  const requested = submit(swapped);
  assert.equal(requested.route.kind, 'loading');
  assert.deepEqual(requested.route.origin, destination);
  assert.deepEqual(requested.route.destination, origin);
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
  assert.equal(state.route.kind, 'idle');
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

const alternatives = [itinerary, { ...itinerary, durationMinutes: 28 }];

test('labels every fixed destination map marker with the article title without changing the API response', () => {
  const fixedDestination = { name: 'Kadıköy İskelesi Nasıl Gidilir?', latitude: 41.0201, longitude: 29.03 };
  const initial = submit(createPlannerState({ origin }, fixedDestination));
  assert.equal(initial.route.kind, 'loading');
  const result = reducePlanner(initial, { type: 'route-succeeded', id: initial.route.id, departureAt, alternatives });
  assert.equal(result.route.kind, 'success');

  for (const alternative of result.route.alternatives) {
    const arrivalMarker = buildTransitMapModel(alternative).markers.find(({ points }) =>
      points.some(({ role }) => role === 'destination'));
    assert.deepEqual(arrivalMarker?.coordinate, [41.0201, 29.03]);
    assert.equal(arrivalMarker?.points.find(({ role }) => role === 'destination')?.name, 'Kadıköy İskelesi Nasıl Gidilir?');
    assert.deepEqual(buildTimelineItems(alternative), buildTimelineItems(itinerary));
  }
  assert.equal(itinerary.keyPoints.find(({ role }) => role === 'destination')?.name, 'Hedef');
});

test('leaves route results for an editable destination as received from the API', () => {
  const initial = submit(createPlannerState({ origin, destination }));
  assert.equal(initial.route.kind, 'loading');
  const result = reducePlanner(initial, { type: 'route-succeeded', id: initial.route.id, departureAt, alternatives });
  assert.equal(result.route.kind, 'success');
  assert.equal(result.route.alternatives, alternatives);
});

test('rejects a cancelled route response and retries with a new request ID', () => {
  const initial = submit(createPlannerState({ origin, destination }));
  assert.equal(initial.route.kind, 'loading');
  const id = initial.route.id;
  const cancelled = reducePlanner(initial, { type: 'cancel-route' });
  assert.equal(cancelled.route.kind, 'idle');
  assert.equal(reducePlanner(cancelled, { type: 'route-succeeded', id, departureAt, alternatives }), cancelled);

  const retry = reducePlanner(cancelled, { type: 'retry-route', departureAt: '2026-11-10T07:01:00.000Z' });
  assert.equal(retry.route.kind, 'loading');
  assert.notEqual(retry.route.id, id);
  assert.equal(reducePlanner(retry, { type: 'route-failed', id, message: 'Eski hata' }), retry);
});

test('changing route options invalidates results and waits for another submit', () => {
  const initial = submit(createPlannerState({ origin, destination }));
  assert.equal(initial.route.kind, 'loading');
  const preferred = reducePlanner(initial, { type: 'set-preference', preference: 'less-walking' });
  assert.equal(preferred.route.kind, 'idle');
  assert.equal(reducePlanner(preferred, {
    type: 'route-succeeded', id: initial.route.id, departureAt, alternatives,
  }), preferred);
  const requested = submit(preferred, '2026-11-10T07:02:00.000Z');
  assert.equal(requested.route.kind, 'loading');
  assert.equal(requested.route.departureAt, '2026-11-10T07:02:00.000Z');
  assert.equal(requested.route.preference, 'less-walking');
});

test('keeps the selected travel mode idle until submit and captures it in the request', () => {
  const initial = createPlannerState({ origin, destination });
  assert.equal(initial.travelMode, 'transit');
  const changed = reducePlanner(initial, { type: 'set-travel-mode', travelMode: 'metro' });
  assert.equal(changed.route.kind, 'idle');
  assert.equal(changed.travelMode, 'metro');
  const requested = submit(changed);
  assert.equal(requested.route.kind, 'loading');
  assert.equal(requested.route.travelMode, 'metro');
});

test('exposes a current route error and clears it when retrying', () => {
  const initial = submit(createPlannerState({ origin, destination }));
  assert.equal(initial.route.kind, 'loading');
  const failed = reducePlanner(initial, {
    type: 'route-failed', id: initial.route.id, message: 'Toplu taşıma verileri şu anda kullanılamıyor.',
  });
  assert.deepEqual(failed.route, {
    kind: 'error', message: 'Toplu taşıma verileri şu anda kullanılamıyor.',
  });
  const retry = reducePlanner(failed, { type: 'retry-route', departureAt: '2026-11-10T07:03:00.000Z' });
  assert.equal(retry.route.kind, 'loading');
  assert.notEqual(retry.route.id, initial.route.id);
});

test('restores an available alternative and ignores invalid selection indexes', () => {
  const initial = submit(createPlannerState({ origin, destination, selectedAlternative: 1 }));
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

test('restores the shared alternative after route failure and cancellation when retrying unchanged inputs', () => {
  const initial = submit(createPlannerState({ origin, destination, departureAt, selectedAlternative: 1 }));
  assert.equal(initial.route.kind, 'loading');
  const failed = reducePlanner(initial, { type: 'route-failed', id: initial.route.id, message: 'Rota hatası' });
  const retry = reducePlanner(failed, { type: 'retry-route', departureAt });
  const cancelled = reducePlanner(retry, { type: 'cancel-route' });
  const resumed = reducePlanner(cancelled, { type: 'retry-route', departureAt });
  assert.equal(resumed.route.kind, 'loading');
  const result = reducePlanner(resumed, { type: 'route-succeeded', id: resumed.route.id, departureAt, alternatives });
  assert.equal(result.route.kind, 'success');
  assert.equal(result.route.selectedAlternative, 1);
});

test('toggles the selected itinerary step and clears focus on an alternative or a new result', () => {
  const initial = submit(createPlannerState({ origin, destination }));
  assert.equal(initial.route.kind, 'loading');
  const selectStep = { type: 'select-step', index: 1 } as const;
  assert.equal(reducePlanner(initial, selectStep), initial);

  const result = reducePlanner(initial, { type: 'route-succeeded', id: initial.route.id, departureAt, alternatives });
  const focused = reducePlanner(result, selectStep);
  assert.equal(focused.route.kind, 'success');
  assert.equal(focused.route.selectedStep, 1);
  for (const index of [-1, 0.5, itinerary.steps.length]) {
    assert.equal(reducePlanner(focused, { type: 'select-step', index }), focused);
  }
  assert.equal(reducePlanner(focused, { type: 'select-alternative', index: 0 }), focused);

  const cleared = reducePlanner(focused, selectStep);
  assert.equal(cleared.route.kind, 'success');
  assert.equal(cleared.route.selectedStep, null);
  const changed = reducePlanner(focused, { type: 'select-alternative', index: 1 });
  assert.equal(changed.route.kind, 'success');
  assert.equal(changed.route.selectedStep, null);

  const recalculated = reducePlanner(focused, { type: 'set-preference', preference: 'less-walking' });
  assert.equal(recalculated.route.kind, 'idle');
  const requested = submit(recalculated);
  assert.equal(requested.route.kind, 'loading');
  const next = reducePlanner(requested, { type: 'route-succeeded', id: requested.route.id, departureAt, alternatives });
  assert.equal(next.route.kind, 'success');
  assert.equal(next.route.selectedStep, null);
});

test('uses the first alternative after the route inputs change', () => {
  const initial = submit(createPlannerState({ origin, destination, departureAt, selectedAlternative: 1 }));
  const changed = reducePlanner(initial, { type: 'set-preference', preference: 'fewer-transfers' });
  assert.equal(changed.route.kind, 'idle');
  const requested = submit(changed);
  assert.equal(requested.route.kind, 'loading');
  const result = reducePlanner(requested, { type: 'route-succeeded', id: requested.route.id, departureAt, alternatives });
  assert.equal(result.route.kind, 'success');
  assert.equal(result.route.selectedAlternative, 0);
});
