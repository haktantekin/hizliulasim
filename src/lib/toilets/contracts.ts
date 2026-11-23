export type ToiletSource = 'ibb' | 'osm';
export type ToiletFlag = 'yes' | 'no' | 'unknown';

export interface Toilet {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  district: string | null;
  kind: 'public' | 'mosque' | 'shopping' | 'fuel' | 'transport' | 'park' | 'other';
  fee: ToiletFlag;
  access: 'yes' | 'customers' | 'permissive' | 'unknown';
  wheelchair: ToiletFlag | 'limited';
  openingHours: string | null;
  changingTable: ToiletFlag;
  source: ToiletSource;
  sourceUrl: string;
  status: 'active' | 'seasonal' | 'unknown';
}

export interface ToiletSourceState {
  updatedAt: string | null;
  status: 'current' | 'stale' | 'unavailable';
  count: number;
}

export interface ToiletEnvelope {
  schemaVersion: 1;
  updatedAt: string | null;
  sources: Record<ToiletSource, ToiletSourceState>;
  toilets: Toilet[];
  metadata?: { storage: 'database'; stale: boolean };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function nullableText(value: unknown, max: number): value is string | null {
  return value === null || text(value, max);
}

function date(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)));
}

function oneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

export function isTurkeyCoordinate(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 35.5 && lat <= 42.5 && lng >= 25.5 && lng <= 45;
}

function validSourceUrl(value: unknown, source: ToiletSource): value is string {
  if (!text(value, 512)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return source === 'osm'
      ? url.hostname === 'www.openstreetmap.org' && /^\/(node|way|relation)\/\d+$/u.test(url.pathname)
      : url.hostname === 'data.ibb.gov.tr' && url.pathname.startsWith('/dataset/');
  } catch {
    return false;
  }
}

function isToilet(value: unknown): value is Toilet {
  if (!isRecord(value) || !oneOf(value.source, ['ibb', 'osm'])) return false;
  const source = value.source as ToiletSource;
  return text(value.id, 128) && value.id.startsWith(`${source}:`) && text(value.name, 256)
    && isTurkeyCoordinate(value.lat, value.lng)
    && nullableText(value.city, 128) && nullableText(value.district, 128)
    && oneOf(value.kind, ['public', 'mosque', 'shopping', 'fuel', 'transport', 'park', 'other'])
    && oneOf(value.fee, ['yes', 'no', 'unknown'])
    && oneOf(value.access, ['yes', 'customers', 'permissive', 'unknown'])
    && oneOf(value.wheelchair, ['yes', 'no', 'limited', 'unknown'])
    && nullableText(value.openingHours, 512) && oneOf(value.changingTable, ['yes', 'no', 'unknown'])
    && oneOf(value.status, ['active', 'seasonal', 'unknown']) && validSourceUrl(value.sourceUrl, source);
}

/** Validate CMS data before exposing it to the frontend. */
export function parseToiletEnvelope(value: unknown): ToiletEnvelope {
  if (!isRecord(value) || value.schemaVersion !== 1 || !date(value.updatedAt)
    || !isRecord(value.sources) || !Array.isArray(value.toilets) || value.toilets.length > 50_000) {
    throw new TypeError('Invalid toilet dataset');
  }
  const sources = {} as Record<ToiletSource, ToiletSourceState>;
  const counts = { ibb: 0, osm: 0 };
  const ids = new Set<string>();
  for (const entry of value.toilets) {
    if (!isToilet(entry) || ids.has(entry.id)) throw new TypeError('Invalid toilet record');
    ids.add(entry.id);
    counts[entry.source]++;
  }
  for (const source of ['ibb', 'osm'] as const) {
    const state = value.sources[source];
    if (!isRecord(state) || !date(state.updatedAt)
      || !oneOf(state.status, ['current', 'stale', 'unavailable'])
      || state.count !== counts[source]
      || (state.status === 'unavailable' ? state.count !== 0 : !state.updatedAt)) {
      throw new TypeError('Invalid toilet source state');
    }
    sources[source] = { updatedAt: state.updatedAt, status: state.status as ToiletSourceState['status'], count: counts[source] };
  }
  const sourceDates = Object.values(sources).flatMap((state) => state.updatedAt ? [Date.parse(state.updatedAt)] : []);
  if (sourceDates.length
    ? value.updatedAt === null || Date.parse(value.updatedAt) !== Math.max(...sourceDates)
    : value.updatedAt !== null) throw new TypeError('Invalid toilet dataset date');
  return { schemaVersion: 1, updatedAt: value.updatedAt, sources, toilets: value.toilets as Toilet[] };
}
