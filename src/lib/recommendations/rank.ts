import type {
  CalendarContext,
  DailyRecommendationCard,
  EditorialOverride,
  RecommendationCandidate,
  RecommendationLocation,
  RecommendationSlot,
  WeatherContext,
} from './contracts.ts';

export interface RankRecommendationsInput {
  candidates: RecommendationCandidate[];
  overrides: EditorialOverride[];
  weather: WeatherContext | null;
  calendar: CalendarContext;
  location?: RecommendationLocation;
  now: Date;
}

const slots: RecommendationSlot[] = ['best', 'nearby', 'free'];

function distanceKm(left: RecommendationLocation, right: RecommendationLocation): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const radiusKm = 6371;
  const deltaLatitude = toRadians(right.latitude - left.latitude);
  const deltaLongitude = toRadians(right.longitude - left.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(left.latitude)) * Math.cos(toRadians(right.latitude))
    * Math.sin(deltaLongitude / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isEligible(candidate: RecommendationCandidate, calendar: CalendarContext): boolean {
  return candidate.profile.enabled
    && (candidate.profile.seasonMonths.length === 0 || candidate.profile.seasonMonths.includes(calendar.month));
}

function weatherScore(candidate: RecommendationCandidate, weather: WeatherContext | null, calendar: CalendarContext): number {
  if (!weather) return 0;
  const { profile } = candidate;
  let score = 0;
  if (weather.tags.includes('rain')) {
    if (profile.venueMode === 'indoor') score += 35;
    if (profile.venueMode === 'outdoor') score -= 40;
    if (profile.weatherFit.includes('rain')) score += 25;
  }
  if (weather.tags.includes('clear')) {
    if (profile.venueMode === 'outdoor') score += 25;
    if (profile.weatherFit.includes('clear')) score += 20;
  }
  if (weather.tags.includes('hot')) {
    if (profile.weatherFit.includes('hot')) score += 20;
    if (calendar.hour >= 11 && calendar.hour <= 17 && profile.venueMode === 'indoor') score += 15;
    if (calendar.hour >= 11 && calendar.hour <= 17 && profile.venueMode === 'outdoor') score -= 10;
  }
  if (weather.tags.includes('cold')) {
    if (profile.venueMode === 'indoor') score += 20;
    if (profile.venueMode === 'outdoor') score -= 15;
    if (profile.weatherFit.includes('cold')) score += 20;
  }
  if (weather.tags.includes('windy')) {
    if (profile.weatherFit.includes('wind_safe')) score += 30;
    else if (profile.venueMode === 'outdoor') score -= 35;
  }
  return score;
}

function temporalScore(candidate: RecommendationCandidate, calendar: CalendarContext): number {
  let score = candidate.profile.editorialWeight;
  if (candidate.profile.calendarTags.some((tag) => calendar.calendarTags.includes(tag))) score += 60;
  if (calendar.isWeekend && candidate.profile.durationBand !== 'short') score += 8;
  if (!calendar.isWeekend && calendar.hour >= 17 && candidate.profile.durationBand === 'short') score += 8;
  return score;
}

function proximityScore(candidate: RecommendationCandidate, location?: RecommendationLocation): number {
  if (!location) return candidate.profile.district ? 3 : 0;
  if (!candidate.location) return -1000;
  const distance = distanceKm(location, candidate.location);
  if (distance <= 2) return 45;
  if (distance <= 5) return 35;
  if (distance <= 15) return 20;
  if (distance <= 30) return 8;
  return 0;
}

function candidateScore(
  candidate: RecommendationCandidate,
  slot: RecommendationSlot,
  input: RankRecommendationsInput,
): number {
  let score = temporalScore(candidate, input.calendar) + weatherScore(candidate, input.weather, input.calendar);
  if (slot === 'nearby') score += proximityScore(candidate, input.location);
  else if (input.location && candidate.location) score += Math.max(0, proximityScore(candidate, input.location) / 4);
  if (slot === 'free' && candidate.profile.budget === 'free') score += 25;
  return score;
}

function isActiveOverride(override: EditorialOverride, now: Date): boolean {
  const timestamp = now.getTime();
  return Date.parse(override.startAt) <= timestamp && timestamp < Date.parse(override.endAt);
}

function selectOverride(
  slot: RecommendationSlot,
  input: RankRecommendationsInput,
  candidatesById: Map<number, RecommendationCandidate>,
  used: Set<number>,
): { candidate: RecommendationCandidate; override: EditorialOverride } | null {
  const ordered = input.overrides
    .filter((override) => isActiveOverride(override, input.now) && (override.slot === slot || override.slot === 'all'))
    .sort((left, right) => right.priority - left.priority || right.id - left.id);
  for (const override of ordered) {
    const candidate = candidatesById.get(override.postId);
    if (!candidate || used.has(candidate.id) || !isEligible(candidate, input.calendar)) continue;
    if (slot === 'free' && candidate.profile.budget !== 'free') continue;
    return { candidate, override };
  }
  return null;
}

function selectAutomatic(
  slot: RecommendationSlot,
  input: RankRecommendationsInput,
  used: Set<number>,
): RecommendationCandidate | null {
  const candidates = input.candidates.filter((candidate) => (
    !used.has(candidate.id)
    && isEligible(candidate, input.calendar)
    && (slot !== 'free' || candidate.profile.budget === 'free')
    && (slot !== 'nearby' || !input.location || Boolean(candidate.location))
  ));
  candidates.sort((left, right) => {
    const difference = candidateScore(right, slot, input) - candidateScore(left, slot, input);
    return difference || left.id - right.id;
  });
  return candidates[0] ?? null;
}

function automaticReason(
  candidate: RecommendationCandidate,
  slot: RecommendationSlot,
  input: RankRecommendationsInput,
): Pick<DailyRecommendationCard, 'reason' | 'reasonCode'> {
  if (slot === 'nearby' && input.location && candidate.location) {
    return { reason: 'Konumuna yakın seçeneklerden biri.', reasonCode: 'nearby' };
  }
  if (slot === 'free') return { reason: 'Bugün değerlendirebileceğin ücretsiz bir seçenek.', reasonCode: 'free' };
  if (candidate.profile.calendarTags.some((tag) => input.calendar.calendarTags.includes(tag))) {
    return { reason: 'Bugünün anlamına uygun öne çıkan bir durak.', reasonCode: 'calendar' };
  }
  if (input.weather?.tags.includes('rain')
    && (candidate.profile.venueMode === 'indoor' || candidate.profile.weatherFit.includes('rain'))) {
    return { reason: 'Bugün yağış beklendiği için kapalı bir seçenek.', reasonCode: 'rain' };
  }
  if (input.weather?.tags.includes('clear')
    && (candidate.profile.venueMode === 'outdoor' || candidate.profile.weatherFit.includes('clear'))) {
    return { reason: 'Hava açık; dışarıda vakit geçirmek için uygun.', reasonCode: 'clear' };
  }
  if (input.weather?.tags.includes('hot') && candidate.profile.weatherFit.includes('hot')) {
    return { reason: 'Sıcak havaya uygun seçeneklerden biri.', reasonCode: 'hot' };
  }
  if (input.weather?.tags.includes('cold')
    && (candidate.profile.venueMode === 'indoor' || candidate.profile.weatherFit.includes('cold'))) {
    return { reason: 'Soğuk havada değerlendirilebilecek bir seçenek.', reasonCode: 'cold' };
  }
  return {
    reason: slot === 'nearby' ? 'İstanbul’da kolay ulaşılabilir seçeneklerden biri.' : 'Bugün için öne çıkan seçeneklerden biri.',
    reasonCode: 'general',
  };
}

export function rankRecommendations(input: RankRecommendationsInput): DailyRecommendationCard[] {
  const candidatesById = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
  const cards: DailyRecommendationCard[] = [];
  const used = new Set<number>();

  for (const slot of slots) {
    const editorial = selectOverride(slot, input, candidatesById, used);
    const candidate = editorial?.candidate ?? selectAutomatic(slot, input, used);
    if (!candidate) continue;
    const distance = input.location && candidate.location ? distanceKm(input.location, candidate.location) : undefined;
    const reason = editorial
      ? { reason: editorial.override.reason || 'Editörün bugünkü seçimi.', reasonCode: 'editorial' as const }
      : automaticReason(candidate, slot, input);
    cards.push({
      slot,
      candidate,
      ...reason,
      ...(distance !== undefined ? { distanceKm: Math.round(distance * 10) / 10 } : {}),
      editorial: Boolean(editorial),
    });
    used.add(candidate.id);
  }

  return cards;
}
