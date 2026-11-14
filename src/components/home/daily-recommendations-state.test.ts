import assert from 'node:assert/strict';
import test from 'node:test';

import type { DailyRecommendationsResponse, RecommendationCandidate } from '../../lib/recommendations/contracts.ts';

import {
  createLatestRequestController,
  initialDailyRecommendationsState,
  parseActiveAlertCount,
  parseActiveAlertTotal,
  parseDailyRecommendationsResponse,
  parseTrafficSummary,
  reduceDailyRecommendationsState,
  shouldAutoRefreshForPermission,
} from './daily-recommendations-state.ts';
import * as dailyRecommendationsState from './daily-recommendations-state.ts';

const candidate: RecommendationCandidate = {
  id: 1,
  title: 'İstanbul Oyuncak Müzesi',
  excerpt: 'Kapalı müze.',
  href: '/ulasim-rehberi/muzeler/istanbul-oyuncak-muzesi',
  image: null,
  category: { slug: 'muzeler', name: 'Müzeler', parentSlug: 'ulasim-rehberi' },
  tags: ['istanbul'],
  profile: {
    enabled: true,
    venueMode: 'indoor',
    weatherFit: ['rain'],
    budget: 'paid',
    audiences: ['general'],
    durationBand: 'half_day',
    seasonMonths: [],
    calendarTags: [],
    district: 'Kadıköy',
    editorialWeight: 10,
  },
  location: { latitude: 40.9993, longitude: 29.0698 },
};

const response = {
  cards: [{
    slot: 'best',
    candidate,
    reason: 'Bugün yağış beklendiği için kapalı bir seçenek.',
    reasonCode: 'rain',
    editorial: false,
  }],
  context: {
    weather: {
      tags: ['rain', 'wind_safe'],
      temperatureC: 12,
      apparentTemperatureC: 10,
      precipitationProbability: 80,
      windSpeedKmh: 12,
      summary: 'Yağışlı',
      observedAt: '2026-11-13T10:00:00.000Z',
    },
    calendarTags: [],
    locationApplied: false,
  },
  freshness: { cms: '2026-11-13T09:55:00.000Z', weather: '2026-11-13T10:00:00.000Z' },
  degradedSources: [],
} satisfies DailyRecommendationsResponse;

test('istemci sözleşmesini doğrular, dış bağlantı ve aşırı metni reddeder', () => {
  assert.deepEqual(parseDailyRecommendationsResponse(response), response);
  assert.equal(parseDailyRecommendationsResponse({
    ...response,
    cards: [{ ...response.cards[0], candidate: { ...candidate, href: 'https://evil.example' } }],
  }), null);
  assert.equal(parseDailyRecommendationsResponse({
    ...response,
    cards: [{ ...response.cards[0], reason: 'x'.repeat(181) }],
  }), null);
});

test('ilk yükleme, boş sonuç ve başarılı sonucu ayrı durumlarda tutar', () => {
  const loading = reduceDailyRecommendationsState(initialDailyRecommendationsState, { type: 'load-start' });
  assert.equal(loading.status, 'loading');

  const empty = reduceDailyRecommendationsState(loading, {
    type: 'load-success', payload: { ...response, cards: [] },
  });
  assert.equal(empty.status, 'empty');

  const ready = reduceDailyRecommendationsState(loading, { type: 'load-success', payload: response });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.data?.cards.length, 1);
});

test('konum reddi veya yenileme hatası İstanbul geneli kartlarını korur', () => {
  const ready = reduceDailyRecommendationsState(initialDailyRecommendationsState, {
    type: 'load-success', payload: response,
  });
  const refreshing = reduceDailyRecommendationsState(ready, { type: 'location-start' });
  assert.equal(refreshing.status, 'refreshing');
  assert.equal(refreshing.data, response);

  const denied = reduceDailyRecommendationsState(refreshing, { type: 'location-denied' });
  assert.equal(denied.status, 'ready');
  assert.equal(denied.data, response);
  assert.match(denied.notice ?? '', /izni/u);

  const failed = reduceDailyRecommendationsState(refreshing, { type: 'load-failure' });
  assert.equal(failed.status, 'ready');
  assert.equal(failed.data, response);
});

test('trafik ve uyarı özetleri birbirinden bağımsız doğrulanır', () => {
  assert.deepEqual(parseTrafficSummary({ index: 64, date: '2026-11-13T10:00:00Z' }), { index: 64, label: 'Yoğun' });
  assert.equal(parseTrafficSummary({ error: 'unavailable' }), null);
  assert.equal(parseActiveAlertCount([{ HATKODU: '500T' }, { HATKODU: '34AS' }]), 2);
  assert.equal(parseActiveAlertCount({ error: true }), null);
  assert.equal(parseActiveAlertTotal('229'), 229);
  assert.equal(parseActiveAlertTotal(null), null);
  assert.equal(parseActiveAlertTotal('501'), null);
});

test('yalnız daha önce verilmiş konum izninde otomatik yeniler', () => {
  assert.equal(shouldAutoRefreshForPermission('granted'), true);
  assert.equal(shouldAutoRefreshForPermission('prompt'), false);
  assert.equal(shouldAutoRefreshForPermission('denied'), false);
  assert.equal(shouldAutoRefreshForPermission(undefined), false);
});

test('yeni istek başlayınca eski isteği iptal eder', () => {
  const requests = createLatestRequestController();
  const first = requests.start();
  const second = requests.start();
  assert.equal(first.aborted, true);
  assert.equal(second.aborted, false);
  requests.dispose();
  assert.equal(second.aborted, true);
});

test('asenkron özet kaynakları yüklenirken üç sabit CLS slotunu korur', () => {
  const buildSlots = (dailyRecommendationsState as typeof dailyRecommendationsState & {
    buildDailySummarySlots?: (input: {
      weather: { loaded: boolean; available: boolean };
      traffic: { loaded: boolean; available: boolean };
      alerts: { loaded: boolean; available: boolean };
    }) => Array<{ key: string; status: string }>;
  }).buildDailySummarySlots;

  assert.equal(typeof buildSlots, 'function');
  if (!buildSlots) return;

  assert.deepEqual(buildSlots({
    weather: { loaded: false, available: false },
    traffic: { loaded: false, available: false },
    alerts: { loaded: false, available: false },
  }), [
    { key: 'weather', status: 'loading' },
    { key: 'traffic', status: 'loading' },
    { key: 'alerts', status: 'loading' },
  ]);
  assert.deepEqual(buildSlots({
    weather: { loaded: true, available: true },
    traffic: { loaded: true, available: false },
    alerts: { loaded: true, available: true },
  }), [
    { key: 'weather', status: 'ready' },
    { key: 'traffic', status: 'unavailable' },
    { key: 'alerts', status: 'ready' },
  ]);
});

test('öneriler yüklenirken gerçek üç kart yuvasıyla aynı yer tutucuları üretir', () => {
  const buildPlaceholders = (dailyRecommendationsState as typeof dailyRecommendationsState & {
    buildDailyRecommendationPlaceholderSlots?: (loading: boolean) => string[];
  }).buildDailyRecommendationPlaceholderSlots;

  assert.equal(typeof buildPlaceholders, 'function');
  if (!buildPlaceholders) return;
  assert.deepEqual(buildPlaceholders(true), ['best', 'nearby', 'free']);
  assert.deepEqual(buildPlaceholders(false), []);
});
