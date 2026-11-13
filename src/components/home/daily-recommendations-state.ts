import {
  parseRecommendationSource,
  type CalendarTag,
  type DailyRecommendationCard,
  type DailyRecommendationsResponse,
  type WeatherContext,
  type WeatherTag,
} from '../../lib/recommendations/contracts.ts';

type JsonRecord = Record<string, unknown>;
export type DailyRecommendationsStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'empty' | 'error';

export interface DailyRecommendationsState {
  status: DailyRecommendationsStatus;
  data: DailyRecommendationsResponse | null;
  notice: string | null;
}

export type DailyRecommendationsAction =
  | { type: 'load-start' }
  | { type: 'location-start' }
  | { type: 'load-success'; payload: DailyRecommendationsResponse }
  | { type: 'load-failure' }
  | { type: 'location-denied' };

export const initialDailyRecommendationsState: DailyRecommendationsState = {
  status: 'idle',
  data: null,
  notice: null,
};

const weatherTags: readonly WeatherTag[] = ['rain', 'clear', 'hot', 'cold', 'wind_safe', 'windy'];
const calendarTags: readonly CalendarTag[] = ['republic_day', 'childrens_day', 'youth_day', 'victory_day', 'ataturk_memorial'];
const reasonCodes: DailyRecommendationCard['reasonCode'][] = ['editorial', 'rain', 'clear', 'hot', 'cold', 'nearby', 'free', 'calendar', 'general'];
const cardSlots: DailyRecommendationCard['slot'][] = ['best', 'nearby', 'free'];
const controlCharacter = /[\p{Cc}\uFFFD]/u;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === 'string'
    && (allowEmpty || value.trim().length > 0)
    && [...value].length <= maximum
    && !controlCharacter.test(value);
}

function finiteOrNull(value: unknown, minimum: number, maximum: number): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum);
}

function isoOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)));
}

function uniqueEnumList<T extends string>(value: unknown, allowed: readonly T[], maximum: number): T[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const parsed: T[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.includes(item as T)) return null;
    if (!parsed.includes(item as T)) parsed.push(item as T);
  }
  return parsed;
}

function parseWeather(value: unknown): WeatherContext | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const tags = uniqueEnumList(value.tags, weatherTags, weatherTags.length);
  if (!tags
    || !finiteOrNull(value.temperatureC, -80, 70)
    || !finiteOrNull(value.apparentTemperatureC, -100, 80)
    || !finiteOrNull(value.precipitationProbability, 0, 100)
    || !finiteOrNull(value.windSpeedKmh, 0, 400)
    || !boundedText(value.summary, 80)
    || !isoOrNull(value.observedAt)) return undefined;
  return {
    tags,
    temperatureC: value.temperatureC,
    apparentTemperatureC: value.apparentTemperatureC,
    precipitationProbability: value.precipitationProbability,
    windSpeedKmh: value.windSpeedKmh,
    summary: value.summary,
    observedAt: value.observedAt,
  };
}

function parseCard(value: unknown): DailyRecommendationCard | null {
  if (!isRecord(value) || !isRecord(value.candidate)
    || typeof value.slot !== 'string' || !cardSlots.includes(value.slot as DailyRecommendationCard['slot'])
    || !boundedText(value.reason, 180)
    || typeof value.reasonCode !== 'string' || !reasonCodes.includes(value.reasonCode as DailyRecommendationCard['reasonCode'])
    || typeof value.editorial !== 'boolean') return null;
  const candidate = parseRecommendationSource({ generatedAt: null, candidates: [value.candidate], overrides: [] }).candidates[0];
  if (!candidate) return null;
  if (value.distanceKm !== undefined
    && (typeof value.distanceKm !== 'number' || !Number.isFinite(value.distanceKm) || value.distanceKm < 0 || value.distanceKm > 500)) return null;
  return {
    slot: value.slot as DailyRecommendationCard['slot'],
    candidate,
    reason: value.reason,
    reasonCode: value.reasonCode as DailyRecommendationCard['reasonCode'],
    ...(typeof value.distanceKm === 'number' ? { distanceKm: value.distanceKm } : {}),
    editorial: value.editorial,
  };
}

export function parseDailyRecommendationsResponse(value: unknown): DailyRecommendationsResponse | null {
  if (!isRecord(value) || !Array.isArray(value.cards) || value.cards.length > 3
    || !isRecord(value.context) || !isRecord(value.freshness)) return null;
  const cards = value.cards.map(parseCard);
  if (cards.some((card) => card === null)) return null;
  const parsedCards = cards as DailyRecommendationCard[];
  if (new Set(parsedCards.map((card) => card.slot)).size !== parsedCards.length
    || new Set(parsedCards.map((card) => card.candidate.id)).size !== parsedCards.length) return null;
  const weather = parseWeather(value.context.weather);
  const parsedCalendarTags = uniqueEnumList(value.context.calendarTags, calendarTags, calendarTags.length);
  const degradedSources = uniqueEnumList(value.degradedSources, ['cms', 'weather'] as const, 2);
  if (weather === undefined || !parsedCalendarTags || !degradedSources
    || typeof value.context.locationApplied !== 'boolean'
    || !isoOrNull(value.freshness.cms) || !isoOrNull(value.freshness.weather)) return null;
  return {
    cards: parsedCards,
    context: {
      weather,
      calendarTags: parsedCalendarTags,
      locationApplied: value.context.locationApplied,
    },
    freshness: {
      cms: value.freshness.cms,
      weather: value.freshness.weather,
    },
    degradedSources,
  };
}

export function reduceDailyRecommendationsState(
  state: DailyRecommendationsState,
  action: DailyRecommendationsAction,
): DailyRecommendationsState {
  switch (action.type) {
    case 'load-start':
      return { ...state, status: state.data ? 'refreshing' : 'loading', notice: null };
    case 'location-start':
      return { ...state, status: state.data ? 'refreshing' : 'loading', notice: null };
    case 'load-success':
      return {
        status: action.payload.cards.length === 0 ? 'empty' : 'ready',
        data: action.payload,
        notice: null,
      };
    case 'location-denied':
      return state.data
        ? { ...state, status: 'ready', notice: 'Konum izni verilmedi; İstanbul geneli öneriler gösteriliyor.' }
        : { ...state, status: 'error', notice: 'Konum izni verilmedi.' };
    case 'load-failure':
      return state.data
        ? { ...state, status: 'ready', notice: 'Öneriler yenilenemedi; son sonuçlar gösteriliyor.' }
        : { ...state, status: 'error', notice: 'Bugünün önerileri şu anda alınamıyor.' };
  }
}

export function shouldAutoRefreshForPermission(state: PermissionState | undefined): boolean {
  return state === 'granted';
}

export function createLatestRequestController() {
  let current: AbortController | null = null;
  return {
    start(): AbortSignal {
      current?.abort();
      current = new AbortController();
      return current.signal;
    },
    dispose() {
      current?.abort();
      current = null;
    },
  };
}

export function parseTrafficSummary(value: unknown): { index: number; label: string } | null {
  if (!isRecord(value) || typeof value.index !== 'number' || !Number.isFinite(value.index)
    || value.index < 0 || value.index > 100) return null;
  const label = value.index <= 30 ? 'Rahat' : value.index <= 50 ? 'Normal' : value.index <= 70 ? 'Yoğun' : 'Çok yoğun';
  return { index: value.index, label };
}

export function parseActiveAlertCount(value: unknown): number | null {
  if (!Array.isArray(value) || value.length > 20
    || !value.every((item) => isRecord(item) && boundedText(item.HATKODU, 32))) return null;
  return value.length;
}

export function parseActiveAlertTotal(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/u.test(value)) return null;
  const total = Number(value);
  return total >= 0 && total <= 500 ? total : null;
}

export type DailySummarySlotKey = 'weather' | 'traffic' | 'alerts';
export type DailySummarySlotStatus = 'loading' | 'ready' | 'unavailable';

type DailySummarySourceState = { loaded: boolean; available: boolean };

export function buildDailySummarySlots(input: Record<DailySummarySlotKey, DailySummarySourceState>) {
  return (['weather', 'traffic', 'alerts'] as const).map((key) => ({
    key,
    status: input[key].loaded ? (input[key].available ? 'ready' : 'unavailable') : 'loading',
  }));
}

export function buildDailyRecommendationPlaceholderSlots(loading: boolean): DailyRecommendationCard['slot'][] {
  return loading ? [...cardSlots] : [];
}
