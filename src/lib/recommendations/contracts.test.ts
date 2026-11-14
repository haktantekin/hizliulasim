import assert from 'node:assert/strict';
import test from 'node:test';

import { parseRecommendationSource } from './contracts.ts';

const validCandidate = {
  id: 49,
  title: 'İstanbul Oyuncak Müzesi',
  excerpt: 'Yağmurlu günlerde değerlendirilebilecek kapalı müze.',
  href: '/ulasim-rehberi/muzeler/istanbul-oyuncak-muzesi',
  image: { url: 'https://cms.hizliulasim.com/uploads/muze.jpg', alt: 'Oyuncak Müzesi' },
  category: { slug: 'muzeler', name: 'Müzeler', parentSlug: 'ulasim-rehberi' },
  tags: ['istanbul', 'kultur'],
  profile: {
    enabled: true,
    venueMode: 'indoor',
    weatherFit: ['rain', 'cold'],
    budget: 'paid',
    audiences: ['general', 'children'],
    durationBand: 'half_day',
    seasonMonths: [1, 2, 12],
    calendarTags: ['childrens_day'],
    district: 'Kadıköy',
    editorialWeight: 35,
  },
  location: { latitude: 40.9993, longitude: 29.0698 },
};

const validPayload = {
  generatedAt: '2026-11-13T12:00:00+03:00',
  candidates: [validCandidate],
  overrides: [{
    id: 7,
    postId: 49,
    slot: 'best',
    startAt: '2026-11-13T00:00:00+03:00',
    endAt: '2026-11-14T00:00:00+03:00',
    priority: 20,
    reason: 'Bugünün editör seçimi.',
  }],
};

test('geçerli CMS öneri sözleşmesini güvenli tiplere dönüştürür', () => {
  assert.deepEqual(parseRecommendationSource(validPayload), validPayload);
});

test('etiketsiz eski CMS adayını uyumluluk için boş etiket listesiyle kabul eder', () => {
  const candidateWithoutTags: Partial<typeof validCandidate> = structuredClone(validCandidate);
  delete candidateWithoutTags.tags;
  const parsed = parseRecommendationSource({ ...validPayload, candidates: [candidateWithoutTags] });

  assert.deepEqual(parsed.candidates[0]?.tags, []);
});

test('bozuk adayları bağımsız atar ve yinelenen içerikte ilk geçerli kaydı korur', () => {
  const parsed = parseRecommendationSource({
    ...validPayload,
    candidates: [
      validCandidate,
      { ...validCandidate, id: 50, href: 'https://evil.example/attack' },
      { ...validCandidate, id: 49, title: 'Sonradan gelen kopya' },
      null,
    ],
  });

  assert.deepEqual(parsed.candidates.map(({ id, title }) => ({ id, title })), [
    { id: 49, title: 'İstanbul Oyuncak Müzesi' },
  ]);
});

test('profil enumlarını, sınırları ve metin uzunluklarını doğrular', () => {
  const parsed = parseRecommendationSource({
    ...validPayload,
    candidates: [{
      ...validCandidate,
      title: 'x'.repeat(161),
      profile: { ...validCandidate.profile, venueMode: 'spaceship' },
    }],
    overrides: [{ ...validPayload.overrides[0], priority: 101 }],
  });

  assert.equal(parsed.candidates.length, 0);
  assert.equal(parsed.overrides.length, 0);
});

test('üst seviye sözleşme bozuksa güvenli boş kaynak döndürür', () => {
  assert.deepEqual(parseRecommendationSource({ generatedAt: 'not-a-date', candidates: 'wrong', overrides: null }), {
    generatedAt: null,
    candidates: [],
    overrides: [],
  });
});
