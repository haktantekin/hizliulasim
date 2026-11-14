export type RecommendationSlot = 'best' | 'nearby' | 'free';
export type EditorialSlot = RecommendationSlot | 'all';
export type VenueMode = 'indoor' | 'outdoor' | 'mixed';
export type RecommendationBudget = 'free' | 'paid' | 'unknown';
export type DurationBand = 'short' | 'half_day' | 'full_day';
export type WeatherTag = 'rain' | 'clear' | 'hot' | 'cold' | 'wind_safe' | 'windy';
export type AudienceTag = 'general' | 'family' | 'children' | 'accessible';
export type CalendarTag = 'republic_day' | 'childrens_day' | 'youth_day' | 'victory_day' | 'ataturk_memorial';

export interface RecommendationLocation {
  latitude: number;
  longitude: number;
}

export interface RecommendationProfile {
  enabled: boolean;
  venueMode: VenueMode;
  weatherFit: WeatherTag[];
  budget: RecommendationBudget;
  audiences: AudienceTag[];
  durationBand: DurationBand;
  seasonMonths: number[];
  calendarTags: CalendarTag[];
  district: string;
  editorialWeight: number;
}

export interface RecommendationCandidate {
  id: number;
  title: string;
  excerpt: string;
  href: string;
  image: { url: string; alt: string } | null;
  category: { slug: string; name: string; parentSlug: string };
  tags: string[];
  profile: RecommendationProfile;
  location?: RecommendationLocation;
}

export interface EditorialOverride {
  id: number;
  postId: number;
  slot: EditorialSlot;
  startAt: string;
  endAt: string;
  priority: number;
  reason: string;
}

export interface RecommendationSource {
  generatedAt: string | null;
  candidates: RecommendationCandidate[];
  overrides: EditorialOverride[];
}

export interface WeatherContext {
  tags: WeatherTag[];
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  precipitationProbability: number | null;
  windSpeedKmh: number | null;
  summary: string;
  observedAt: string | null;
}

export interface CalendarContext {
  localDate: string;
  hour: number;
  month: number;
  isWeekend: boolean;
  calendarTags: CalendarTag[];
}

export interface DailyRecommendationCard {
  slot: RecommendationSlot;
  candidate: RecommendationCandidate;
  reason: string;
  reasonCode: 'editorial' | 'rain' | 'clear' | 'hot' | 'cold' | 'nearby' | 'free' | 'calendar' | 'general';
  distanceKm?: number;
  editorial: boolean;
}

export interface DailyRecommendationsResponse {
  cards: DailyRecommendationCard[];
  context: {
    weather: WeatherContext | null;
    calendarTags: CalendarTag[];
    locationApplied: boolean;
  };
  freshness: {
    cms: string | null;
    weather: string | null;
  };
  degradedSources: Array<'cms' | 'weather'>;
}

const maxCandidates = 240;
const maxOverrides = 20;
const controlCharacter = /[\p{Cc}\uFFFD]/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && (allowEmpty || value.trim().length > 0)
    && [...value].length <= maxLength
    && !controlCharacter.test(value);
}

function isFiniteRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value > 0;
}

function isIsoInstant(value: unknown): value is string {
  return isBoundedString(value, 64) && Number.isFinite(Date.parse(value));
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : null;
}

function readEnumList<T extends string>(value: unknown, allowed: readonly T[], maxItems: number): T[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: T[] = [];
  for (const item of value) {
    const parsed = readEnum(item, allowed);
    if (!parsed) return null;
    if (!result.includes(parsed)) result.push(parsed);
  }
  return result;
}

function readTagSlugs(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) return null;
  const result: string[] = [];
  for (const item of value) {
    if (!isBoundedString(item, 100) || !/^[a-z0-9][a-z0-9_-]*$/u.test(item)) return null;
    const normalized = item.toLowerCase();
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
}

function parseLocation(value: unknown): RecommendationLocation | undefined {
  if (!isRecord(value)) return undefined;
  if (!isFiniteRange(value.latitude, 40.5, 42) || !isFiniteRange(value.longitude, 27, 30.5)) return undefined;
  return { latitude: value.latitude, longitude: value.longitude };
}

function parseImage(value: unknown): RecommendationCandidate['image'] | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isBoundedString(value.url, 500) || !isBoundedString(value.alt, 160, true)) return undefined;
  try {
    const url = new URL(value.url);
    if (url.protocol !== 'https:') return undefined;
  } catch {
    return undefined;
  }
  return { url: value.url, alt: value.alt };
}

function isInternalHref(value: unknown): value is string {
  return isBoundedString(value, 500)
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\');
}

function parseCandidate(value: unknown): RecommendationCandidate | null {
  if (!isRecord(value) || !isPositiveInteger(value.id)
    || !isBoundedString(value.title, 160) || !isBoundedString(value.excerpt, 320, true)
    || !isInternalHref(value.href) || !isRecord(value.category) || !isRecord(value.profile)) return null;

  const image = parseImage(value.image);
  if (image === undefined) return null;
  const categorySlug = isBoundedString(value.category.slug, 100) ? value.category.slug.toLowerCase() : null;
  const categoryName = isBoundedString(value.category.name, 120) ? value.category.name : null;
  const parentSlug = isBoundedString(value.category.parentSlug, 100, true) ? value.category.parentSlug.toLowerCase() : null;
  const tags = readTagSlugs(value.tags);
  const venueMode = readEnum(value.profile.venueMode, ['indoor', 'outdoor', 'mixed'] as const);
  const weatherFit = readEnumList(value.profile.weatherFit, ['rain', 'clear', 'hot', 'cold', 'wind_safe', 'windy'] as const, 6);
  const budget = readEnum(value.profile.budget, ['free', 'paid', 'unknown'] as const);
  const audiences = readEnumList(value.profile.audiences, ['general', 'family', 'children', 'accessible'] as const, 4);
  const durationBand = readEnum(value.profile.durationBand, ['short', 'half_day', 'full_day'] as const);
  const calendarTags = readEnumList(value.profile.calendarTags,
    ['republic_day', 'childrens_day', 'youth_day', 'victory_day', 'ataturk_memorial'] as const, 5);
  if (!categorySlug || !categoryName || parentSlug === null || !tags || typeof value.profile.enabled !== 'boolean'
    || !venueMode || !weatherFit || !budget || !audiences || !durationBand || !calendarTags
    || !Array.isArray(value.profile.seasonMonths) || value.profile.seasonMonths.length > 12
    || !value.profile.seasonMonths.every((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    || !isBoundedString(value.profile.district, 100, true)
    || !isFiniteRange(value.profile.editorialWeight, 0, 100)) return null;

  const seasonMonths = [...new Set(value.profile.seasonMonths as number[])].sort((left, right) => left - right);
  const location = parseLocation(value.location);
  if (value.location !== undefined && !location) return null;
  return {
    id: value.id,
    title: value.title,
    excerpt: value.excerpt,
    href: value.href,
    image,
    category: { slug: categorySlug, name: categoryName, parentSlug },
    tags,
    profile: {
      enabled: value.profile.enabled,
      venueMode,
      weatherFit,
      budget,
      audiences,
      durationBand,
      seasonMonths,
      calendarTags,
      district: value.profile.district,
      editorialWeight: value.profile.editorialWeight,
    },
    ...(location ? { location } : {}),
  };
}

function parseOverride(value: unknown): EditorialOverride | null {
  if (!isRecord(value) || !isPositiveInteger(value.id) || !isPositiveInteger(value.postId)
    || !isIsoInstant(value.startAt) || !isIsoInstant(value.endAt)
    || Date.parse(value.startAt) >= Date.parse(value.endAt)
    || !isFiniteRange(value.priority, 0, 100)
    || !isBoundedString(value.reason, 160, true)) return null;
  const slot = readEnum(value.slot, ['best', 'nearby', 'free', 'all'] as const);
  if (!slot) return null;
  return {
    id: value.id,
    postId: value.postId,
    slot,
    startAt: value.startAt,
    endAt: value.endAt,
    priority: value.priority,
    reason: value.reason,
  };
}

export function parseRecommendationSource(value: unknown): RecommendationSource {
  if (!isRecord(value) || !Array.isArray(value.candidates) || !Array.isArray(value.overrides)) {
    return { generatedAt: null, candidates: [], overrides: [] };
  }
  const candidates: RecommendationCandidate[] = [];
  const candidateIds = new Set<number>();
  for (const item of value.candidates.slice(0, maxCandidates)) {
    const candidate = parseCandidate(item);
    if (candidate && !candidateIds.has(candidate.id)) {
      candidates.push(candidate);
      candidateIds.add(candidate.id);
    }
  }
  const overrides: EditorialOverride[] = [];
  const overrideIds = new Set<number>();
  for (const item of value.overrides.slice(0, maxOverrides)) {
    const override = parseOverride(item);
    if (override && !overrideIds.has(override.id)) {
      overrides.push(override);
      overrideIds.add(override.id);
    }
  }
  return {
    generatedAt: isIsoInstant(value.generatedAt) ? value.generatedAt : null,
    candidates,
    overrides,
  };
}
