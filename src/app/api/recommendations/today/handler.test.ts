import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  RecommendationCandidate,
  RecommendationLocation,
  RecommendationSource,
  WeatherContext,
} from '../../../../lib/recommendations/contracts.ts';
import { createDailyRecommendationsHandler } from './handler.ts';

const candidates: RecommendationCandidate[] = [
  {
    id: 1,
    title: 'İstanbul Oyuncak Müzesi',
    excerpt: 'Kapalı müze.',
    href: '/ulasim-rehberi/muzeler/istanbul-oyuncak-muzesi',
    image: null,
    category: { slug: 'muzeler', name: 'Müzeler', parentSlug: 'ulasim-rehberi' },
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
  },
  {
    id: 2,
    title: 'Atatürk Kent Ormanı',
    excerpt: 'Açık hava.',
    href: '/ulasim-rehberi/korular/ataturk-kent-ormani',
    image: null,
    category: { slug: 'korular', name: 'Korular', parentSlug: 'ulasim-rehberi' },
    profile: {
      enabled: true,
      venueMode: 'outdoor',
      weatherFit: ['clear', 'wind_safe'],
      budget: 'free',
      audiences: ['general'],
      durationBand: 'half_day',
      seasonMonths: [],
      calendarTags: [],
      district: 'Sarıyer',
      editorialWeight: 20,
    },
    location: { latitude: 41.173, longitude: 28.99 },
  },
];

const source: RecommendationSource = {
  generatedAt: '2026-11-13T09:00:00.000Z',
  candidates,
  overrides: [],
};

const weather: WeatherContext = {
  tags: ['clear', 'wind_safe'],
  temperatureC: 18,
  apparentTemperatureC: 17,
  precipitationProbability: 10,
  windSpeedKmh: 12,
  summary: 'Açık',
  observedAt: '2026-11-13T09:05:00.000Z',
};

const now = () => new Date('2026-11-13T09:10:00.000Z');
const request = (query = '') => new Request(`http://localhost:3000/api/recommendations/today${query}`);

test('konum yokken İstanbul merkezini hava için kullanır ve genel öneri döndürür', async (t) => {
  const loadWeather = t.mock.fn(async (location: RecommendationLocation) => {
    void location;
    return weather;
  });
  const handler = createDailyRecommendationsHandler({
    now,
    loadSource: async () => source,
    loadWeather,
  });

  const response = await handler(request());
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(loadWeather.mock.calls[0].arguments[0], { latitude: 41.0082, longitude: 28.9784 });
  assert.equal(payload.context.locationApplied, false);
  assert.deepEqual(payload.freshness, { cms: source.generatedAt, weather: weather.observedAt });
  assert.deepEqual(payload.degradedSources, []);
  assert.deepEqual(payload.cards.map((card: { candidate: { id: number } }) => card.candidate.id), [2, 1]);
});

test('geçerli konumu yuvarlar, yakınlık hesabına uygular ve özel yanıtı paylaşımlı önbelleğe koymaz', async (t) => {
  const loadWeather = t.mock.fn(async (location: RecommendationLocation) => {
    void location;
    return weather;
  });
  const handler = createDailyRecommendationsHandler({ now, loadSource: async () => source, loadWeather });

  const response = await handler(request('?lat=40.99931234&lng=29.06981234'));
  const payload = await response.json();

  assert.deepEqual(loadWeather.mock.calls[0].arguments[0], { latitude: 40.99931, longitude: 29.06981 });
  assert.equal(payload.context.locationApplied, true);
  assert.equal(response.headers.get('cache-control'), 'private, max-age=60');
  assert.ok(payload.cards.some((card: { slot: string; candidate: { id: number } }) => card.slot === 'nearby' && card.candidate.id === 1));
});

test('geçersiz, eksik veya bölge dışı koordinatta İstanbul geneline döner', async () => {
  for (const query of ['?lat=x&lng=29', '?lat=41', '?lat=50&lng=40']) {
    let received: unknown;
    const handler = createDailyRecommendationsHandler({
      now,
      loadSource: async () => source,
      loadWeather: async (location) => {
        received = location;
        return weather;
      },
    });
    const payload = await (await handler(request(query))).json();
    assert.deepEqual(received, { latitude: 41.0082, longitude: 28.9784 });
    assert.equal(payload.context.locationApplied, false);
  }
});

test('CMS yoksa 200 ve boş kart; hava yoksa takvim tabanlı kartlarla güvenli fallback döndürür', async () => {
  const noCms = createDailyRecommendationsHandler({ now, loadSource: async () => null, loadWeather: async () => weather });
  const noCmsPayload = await (await noCms(request())).json();
  assert.deepEqual(noCmsPayload.cards, []);
  assert.deepEqual(noCmsPayload.degradedSources, ['cms']);

  const noWeather = createDailyRecommendationsHandler({ now, loadSource: async () => source, loadWeather: async () => null });
  const noWeatherPayload = await (await noWeather(request())).json();
  assert.ok(noWeatherPayload.cards.length > 0 && noWeatherPayload.cards.length < 3);
  assert.equal(noWeatherPayload.context.weather, null);
  assert.deepEqual(noWeatherPayload.degradedSources, ['weather']);
});

test('etkin editör seçimini uygular ve bağımlılık hata ayrıntılarını yanıta sızdırmaz', async () => {
  const editorialSource: RecommendationSource = {
    ...source,
    overrides: [{
      id: 9,
      postId: 1,
      slot: 'best',
      startAt: '2026-11-13T00:00:00.000Z',
      endAt: '2026-11-14T00:00:00.000Z',
      priority: 100,
      reason: 'Bugünün editör seçimi.',
    }],
  };
  const editorial = createDailyRecommendationsHandler({ now, loadSource: async () => editorialSource, loadWeather: async () => weather });
  const editorialPayload = await (await editorial(request())).json();
  assert.equal(editorialPayload.cards[0].candidate.id, 1);
  assert.equal(editorialPayload.cards[0].editorial, true);

  const failed = createDailyRecommendationsHandler({
    now,
    loadSource: async () => { throw new Error('private 41.123456,29.123456'); },
    loadWeather: async () => { throw new Error('private 41.123456,29.123456'); },
  });
  const failedText = await (await failed(request('?lat=41.123456&lng=29.123456'))).text();
  assert.doesNotMatch(failedText, /41\.123456|29\.123456|private/u);
});
