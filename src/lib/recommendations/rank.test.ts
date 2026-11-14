import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CalendarContext,
  EditorialOverride,
  RecommendationCandidate,
  WeatherContext,
} from './contracts.ts';
import { rankRecommendations } from './rank.ts';

const ordinaryCalendar: CalendarContext = {
  localDate: '2026-11-13', hour: 12, month: 11, isWeekend: false, calendarTags: [],
};

function candidate(id: number, changes: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    id,
    title: `Yer ${id}`,
    excerpt: '',
    href: `/ulasim-rehberi/mekanlar/yer-${id}`,
    image: null,
    category: { slug: 'mekanlar', name: 'Mekânlar', parentSlug: 'ulasim-rehberi' },
    tags: ['istanbul'],
    profile: {
      enabled: true,
      venueMode: 'mixed',
      weatherFit: [],
      budget: 'unknown',
      audiences: ['general'],
      durationBand: 'half_day',
      seasonMonths: [],
      calendarTags: [],
      district: 'Fatih',
      editorialWeight: 0,
    },
    ...changes,
  };
}

function weather(tags: WeatherContext['tags'], temperatureC = 15): WeatherContext {
  return {
    tags,
    temperatureC,
    apparentTemperatureC: temperatureC,
    precipitationProbability: tags.includes('rain') ? 80 : 5,
    windSpeedKmh: tags.includes('windy') ? 45 : 8,
    summary: tags.join(', '),
    observedAt: '2026-11-13T12:00:00+03:00',
  };
}

test('yağmurda kapalı mekânı, açık havada dış mekânı en uygun seçer', () => {
  const museum = candidate(1, {
    category: { slug: 'muzeler', name: 'Müzeler', parentSlug: 'ulasim-rehberi' },
    profile: { ...candidate(1).profile, venueMode: 'indoor', weatherFit: ['rain'], budget: 'paid' },
  });
  const grove = candidate(2, {
    category: { slug: 'korular', name: 'Korular', parentSlug: 'ulasim-rehberi' },
    profile: { ...candidate(2).profile, venueMode: 'outdoor', weatherFit: ['clear'], budget: 'free' },
  });

  const rainy = rankRecommendations({ candidates: [grove, museum], overrides: [], weather: weather(['rain']), calendar: ordinaryCalendar, now: new Date('2026-11-13T09:00:00Z') });
  const clear = rankRecommendations({ candidates: [museum, grove], overrides: [], weather: weather(['clear']), calendar: ordinaryCalendar, now: new Date('2026-11-13T09:00:00Z') });

  assert.equal(rainy.find(({ slot }) => slot === 'best')?.candidate.id, 1);
  assert.equal(rainy.find(({ slot }) => slot === 'best')?.reasonCode, 'rain');
  assert.equal(clear.find(({ slot }) => slot === 'best')?.candidate.id, 2);
  assert.equal(clear.find(({ slot }) => slot === 'best')?.reasonCode, 'clear');
});

test('yakınında kartını gerçek mesafeyle seçer ve ücretsiz kartına yalnız doğrulanmış ücretsiz adayı koyar', () => {
  const best = candidate(1, { profile: { ...candidate(1).profile, editorialWeight: 100, budget: 'paid' }, location: { latitude: 41.2, longitude: 29.2 } });
  const nearby = candidate(2, { location: { latitude: 41.009, longitude: 28.979 }, profile: { ...candidate(2).profile, budget: 'paid' } });
  const free = candidate(3, { location: { latitude: 41.03, longitude: 29.01 }, profile: { ...candidate(3).profile, budget: 'free' } });

  const cards = rankRecommendations({
    candidates: [free, nearby, best], overrides: [], weather: null, calendar: ordinaryCalendar,
    location: { latitude: 41.0082, longitude: 28.9784 }, now: new Date('2026-11-13T09:00:00Z'),
  });

  assert.deepEqual(cards.map(({ slot, candidate: item }) => [slot, item.id]), [
    ['best', 1], ['nearby', 2], ['free', 3],
  ]);
  assert.ok((cards[1].distanceKm ?? 99) < 1);
  assert.equal(cards[1].reasonCode, 'nearby');
  assert.equal(cards[2].reasonCode, 'free');
});

test('konum yokken nearby yuvasını kolay ulaşılabilir benzersiz adayla doldurur', () => {
  const cards = rankRecommendations({
    candidates: [candidate(1), candidate(2), candidate(3, { profile: { ...candidate(3).profile, budget: 'free' } })],
    overrides: [], weather: null, calendar: ordinaryCalendar, now: new Date('2026-11-13T09:00:00Z'),
  });

  assert.deepEqual(cards.map(({ slot }) => slot), ['best', 'nearby', 'free']);
  assert.equal(new Set(cards.map(({ candidate: item }) => item.id)).size, 3);
  assert.equal(cards.find(({ slot }) => slot === 'nearby')?.reasonCode, 'general');
});

test('aktif editoryal seçim otomatik sonucu ezer; süresi bitmiş seçim dikkate alınmaz', () => {
  const overrides: EditorialOverride[] = [
    { id: 1, postId: 1, slot: 'best', startAt: '2026-11-11T00:00:00+03:00', endAt: '2026-11-12T00:00:00+03:00', priority: 100, reason: 'Süresi bitti.' },
    { id: 2, postId: 2, slot: 'best', startAt: '2026-11-13T00:00:00+03:00', endAt: '2026-11-14T00:00:00+03:00', priority: 10, reason: 'Bugünün editör seçimi.' },
  ];
  const cards = rankRecommendations({
    candidates: [candidate(1, { profile: { ...candidate(1).profile, editorialWeight: 100 } }), candidate(2), candidate(3, { profile: { ...candidate(3).profile, budget: 'free' } })],
    overrides, weather: null, calendar: ordinaryCalendar, now: new Date('2026-11-13T09:00:00Z'),
  });

  const best = cards.find(({ slot }) => slot === 'best');
  assert.equal(best?.candidate.id, 2);
  assert.equal(best?.reason, 'Bugünün editör seçimi.');
  assert.equal(best?.reasonCode, 'editorial');
  assert.equal(best?.editorial, true);
});

test('mevsim dışı, devre dışı ve rüzgâra uygun olmayan adayları güvenli biçimde geriye atar', () => {
  const winterOnly = candidate(1, { profile: { ...candidate(1).profile, seasonMonths: [1, 2] } });
  const disabled = candidate(2, { profile: { ...candidate(2).profile, enabled: false, editorialWeight: 100 } });
  const exposed = candidate(3, { profile: { ...candidate(3).profile, venueMode: 'outdoor', weatherFit: ['clear'] } });
  const sheltered = candidate(4, { profile: { ...candidate(4).profile, venueMode: 'mixed', weatherFit: ['wind_safe'] } });

  const cards = rankRecommendations({ candidates: [winterOnly, disabled, exposed, sheltered], overrides: [], weather: weather(['windy']), calendar: ordinaryCalendar, now: new Date('2026-11-13T09:00:00Z') });
  assert.equal(cards[0]?.candidate.id, 4);
  assert.ok(cards.every(({ candidate: item }) => item.id !== 1 && item.id !== 2));
});

test('özel gün etiketi eşleşen adayı yükseltir ve aday azsa kopya kart üretmez', () => {
  const ordinary = candidate(1, { profile: { ...candidate(1).profile, editorialWeight: 30 } });
  const republic = candidate(2, { profile: { ...candidate(2).profile, calendarTags: ['republic_day'] } });
  const cards = rankRecommendations({
    candidates: [ordinary, republic], overrides: [], weather: null,
    calendar: { ...ordinaryCalendar, calendarTags: ['republic_day'] }, now: new Date('2026-10-29T09:00:00Z'),
  });

  assert.equal(cards[0]?.candidate.id, 2);
  assert.equal(cards[0]?.reasonCode, 'calendar');
  assert.equal(cards.length, 2);
  assert.equal(new Set(cards.map(({ candidate: item }) => item.id)).size, 2);
});

test('plajı 30 derecenin altında editör seçimi olsa bile eler, 30 derecede seçebilir', () => {
  const beach = candidate(10, {
    category: { slug: 'plajlar', name: 'Plajlar', parentSlug: 'ulasim-rehberi' },
    profile: { ...candidate(10).profile, venueMode: 'outdoor', weatherFit: ['clear', 'hot'], editorialWeight: 100 },
  });
  const museum = candidate(11, {
    category: { slug: 'muzeler', name: 'Müzeler', parentSlug: 'ulasim-rehberi' },
  });
  const overrides: EditorialOverride[] = [{
    id: 50,
    postId: beach.id,
    slot: 'best',
    startAt: '2026-11-13T00:00:00+03:00',
    endAt: '2026-11-14T00:00:00+03:00',
    priority: 100,
    reason: 'Plaj günü.',
  }];

  const cool = rankRecommendations({
    candidates: [beach, museum], overrides, weather: weather(['clear'], 29.9), calendar: ordinaryCalendar,
    cityTag: 'istanbul', now: new Date('2026-11-13T09:00:00Z'),
  });
  const hot = rankRecommendations({
    candidates: [beach, museum], overrides, weather: weather(['clear', 'hot'], 30), calendar: ordinaryCalendar,
    cityTag: 'istanbul', now: new Date('2026-11-13T09:00:00Z'),
  });

  assert.ok(cool.every(({ candidate: item }) => item.id !== beach.id));
  assert.equal(hot.find(({ slot }) => slot === 'best')?.candidate.id, beach.id);
});

test('önerileri WordPress il etiketiyle tam eşleşerek filtreler', () => {
  const istanbul = candidate(20, { tags: ['istanbul'], profile: { ...candidate(20).profile, editorialWeight: 1 } });
  const sanliurfa = candidate(21, { tags: ['sanliurfa'], profile: { ...candidate(21).profile, editorialWeight: 100 } });

  const cards = rankRecommendations({
    candidates: [sanliurfa, istanbul], overrides: [], weather: weather(['clear'], 22), calendar: ordinaryCalendar,
    cityTag: 'istanbul', now: new Date('2026-11-13T09:00:00Z'),
  });

  assert.deepEqual(cards.map(({ candidate: item }) => item.id), [istanbul.id]);
});
