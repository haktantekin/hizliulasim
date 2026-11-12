import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TransitRouteRequest } from './contracts.ts';
import { buildWalkingItineraryFromGoogle, decodeGooglePolyline, requestGoogleWalkingItinerary } from './walking-route.ts';

const query: TransitRouteRequest = {
  origin: [38.5, -120.2],
  destination: [43.252, -126.453],
  departureAt: new Date('2026-11-10T07:00:00.000Z'),
  preference: 'fastest',
  travelMode: 'walking',
};

const googlePayload = {
  status: 'OK',
  routes: [{
    overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    legs: [{ distance: { value: 1000 }, duration: { value: 600 } }],
  }],
};

test('decodes a Google polyline into latitude-longitude coordinates', () => {
  assert.deepEqual(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    [38.5, -120.2], [40.7, -120.95], [43.252, -126.453],
  ]);
});

test('converts a walking Directions route into the shared transit itinerary shape', () => {
  const itinerary = buildWalkingItineraryFromGoogle(googlePayload, query, new Date('2026-11-10T07:00:01.000Z'));
  assert.equal(itinerary.durationMinutes, 10);
  assert.equal(itinerary.walkingMinutes, 10);
  assert.equal(itinerary.transferCount, 0);
  assert.equal(itinerary.departureTime, '10:00');
  assert.equal(itinerary.arrivalTime, '10:10');
  assert.deepEqual(itinerary.steps, [{
    kind: 'walk', mode: 'walking', durationMinutes: 10, distanceMeters: 1000,
    departureTime: '10:00', arrivalTime: '10:10', geometryQuality: 'exact',
    geometry: [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]],
  }]);
  assert.deepEqual(itinerary.keyPoints, [
    { role: 'origin', name: 'Başlangıç', coordinate: query.origin },
    { role: 'destination', name: 'Hedef', coordinate: query.destination },
  ]);
  assert.deepEqual(itinerary.metadata, {
    dataVersion: 'google-directions', generatedAt: '2026-11-10T07:00:01.000Z', serviceDate: '2026-11-10',
    approximateWalking: false, geometryQuality: 'exact',
  });
});

test('requests walking directions only after being called and keeps the key out of the result', async (t) => {
  const fetcher = t.mock.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(googlePayload));
  const itinerary = await requestGoogleWalkingItinerary(query, {
    apiKey: 'secret-key', fetcher: fetcher as typeof fetch, now: () => new Date('2026-11-10T07:00:01.000Z'),
  });
  assert.equal(fetcher.mock.callCount(), 1);
  const [url, init] = fetcher.mock.calls[0].arguments;
  const requestUrl = new URL(String(url));
  assert.equal(requestUrl.origin + requestUrl.pathname, 'https://maps.googleapis.com/maps/api/directions/json');
  assert.equal(requestUrl.searchParams.get('mode'), 'walking');
  assert.equal(requestUrl.searchParams.get('key'), 'secret-key');
  assert.equal(init?.cache, 'no-store');
  assert.doesNotMatch(JSON.stringify(itinerary), /secret-key/u);
});
