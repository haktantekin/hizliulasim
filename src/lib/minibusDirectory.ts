import type {
  MinibusCachedData,
  MinibusLine,
  MinibusLineDetails,
  MinibusOperatingWindow,
  MinibusRoutePoint,
  MinibusSchedule,
  MinibusStop,
  MinibusVehicleType,
} from './minibusData.ts';
import { ISTANBUL_DISTRICTS } from './districts.ts';
import { slugify } from './slugify.ts';

const ISTANBUL_DISTRICT_BY_SLUG = new Map(
  ISTANBUL_DISTRICTS.map((name) => [slugify(name), name]),
);

export type MinibusDistrict = {
  id: number;
  name: string;
  slug: string;
  cityId: number;
  cityName: string;
  citySlug: string;
  sourceIds: string[];
  lineIds: number[];
};

export type MinibusEditorialLine = {
  id: number;
  categoryId: number;
  code: string;
  name: string;
  slug: string;
  cityId: number;
  cityName: string;
  citySlug: string;
  sourceIds: string[];
  vehicleType: MinibusVehicleType;
  infoHtml: string;
  data: MinibusCachedData | null;
};

export class MinibusDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MinibusDirectoryError';
  }
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MinibusDirectoryError(`${label} bir nesne olmalıdır.`);
  }
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new MinibusDirectoryError(`${label} pozitif bir tam sayı olmalıdır.`);
  }
  return Number(value);
}

function textValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MinibusDirectoryError(`${label} boş olamaz.`);
  }
  return value.trim();
}

function sourceId(value: unknown): string {
  const candidate = textValue(value, 'Minibüs kaynak kimliği');
  const match = candidate.match(/^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i);
  if (!match) {
    throw new MinibusDirectoryError(`Geçersiz minibüs kaynak kimliği: ${candidate}`);
  }
  return `{${match[1].toUpperCase()}}`;
}

function integerArray(value: unknown, label: string): number[] {
  if (!Array.isArray(value)) {
    throw new MinibusDirectoryError(`${label} bir dizi olmalıdır.`);
  }
  const result: number[] = [];
  for (const item of value) {
    const parsed = positiveInteger(item, label);
    if (!result.includes(parsed)) result.push(parsed);
  }
  return result;
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new MinibusDirectoryError(`${label} geçerli bir sayı olmalıdır.`);
  }
  return value;
}

function clockValue(value: unknown, label: string): string {
  const clock = textValue(value, label);
  const match = clock.match(/^(\d{2}):(\d{2})$/);
  const hour = match ? Number(match[1]) : Number.NaN;
  const minute = match ? Number(match[2]) : Number.NaN;
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
    throw new MinibusDirectoryError(`${label} geçerli bir saat olmalıdır.`);
  }
  return clock;
}

function operatingWindow(value: unknown, label: string): MinibusOperatingWindow | undefined {
  if (value === undefined) return undefined;
  const window = objectValue(value, label);
  const intervalMinutes = window.intervalMinutes;
  if (!Number.isInteger(intervalMinutes) || Number(intervalMinutes) < 0) {
    throw new MinibusDirectoryError(`${label} sefer aralığı negatif olmayan bir tam sayı olmalıdır.`);
  }
  return {
    start: clockValue(window.start, `${label} başlangıç`),
    end: clockValue(window.end, `${label} bitiş`),
    intervalMinutes: Number(intervalMinutes),
  };
}

function routePoints(value: unknown, label: string): MinibusRoutePoint[] {
  if (!Array.isArray(value)) {
    throw new MinibusDirectoryError(`${label} bir koordinat dizisi olmalıdır.`);
  }
  return value.map((item) => {
    const point = objectValue(item, `${label} koordinatı`);
    const lat = point.lat;
    const lng = point.lng;
    if (
      typeof lat !== 'number'
      || typeof lng !== 'number'
      || !Number.isFinite(lat)
      || !Number.isFinite(lng)
      || lat < -90
      || lat > 90
      || lng < -180
      || lng > 180
    ) {
      throw new MinibusDirectoryError(`${label} içinde geçersiz koordinat bulundu.`);
    }
    return { lat, lng };
  });
}

function clockList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new MinibusDirectoryError(`${label} bir saat dizisi olmalıdır.`);
  }
  return value.map((item) => clockValue(item, label));
}

function scheduleValue(value: unknown, label: string): MinibusSchedule {
  const schedule = objectValue(value, label);
  return {
    weekdayOutbound: clockList(schedule.weekdayOutbound, `${label} hafta içi gidiş`),
    weekdayReturn: clockList(schedule.weekdayReturn, `${label} hafta içi dönüş`),
    weekendOutbound: clockList(schedule.weekendOutbound, `${label} hafta sonu gidiş`),
    weekendReturn: clockList(schedule.weekendReturn, `${label} hafta sonu dönüş`),
  };
}

function stopsValue(value: unknown, label: string): MinibusStop[] {
  if (!Array.isArray(value)) {
    throw new MinibusDirectoryError(`${label} bir durak dizisi olmalıdır.`);
  }
  const ids = new Set<number>();
  return value.map((item) => {
    const stop = objectValue(item, `${label} durağı`);
    const id = positiveInteger(stop.id, `${label} durak ID`);
    if (ids.has(id)) throw new MinibusDirectoryError(`${label} içinde yinelenen durak ID: ${id}`);
    ids.add(id);
    return { id, name: textValue(stop.name, `${label} durak adı`) };
  });
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new MinibusDirectoryError(`${label} bir dizi olmalıdır.`);
  return value.map((item) => textValue(item, label));
}

function cachedDataValue(value: unknown, label: string): MinibusCachedData | null {
  if (value === undefined || value === null) return null;
  const data = objectValue(value, `${label} saklı verisi`);
  const detailsValue = objectValue(data.details, `${label} detayları`);
  const details: MinibusLineDetails = {
    routeName: textValue(detailsValue.routeName, `${label} güzergâh adı`),
  };
  const lengthKm = optionalFiniteNumber(detailsValue.lengthKm, `${label} uzunluğu`);
  const durationMinutes = optionalFiniteNumber(detailsValue.durationMinutes, `${label} süresi`);
  if (lengthKm !== undefined) details.lengthKm = lengthKm;
  if (durationMinutes !== undefined) details.durationMinutes = durationMinutes;
  if (detailsValue.sourceRouteId !== undefined) {
    details.sourceRouteId = textValue(detailsValue.sourceRouteId, `${label} kaynak güzergâh ID`);
  }
  if (detailsValue.sourceObjectId !== undefined) {
    details.sourceObjectId = textValue(detailsValue.sourceObjectId, `${label} kaynak nesne ID`);
  }
  const weekday = operatingWindow(detailsValue.weekday, `${label} hafta içi`);
  const weekend = operatingWindow(detailsValue.weekend, `${label} hafta sonu`);
  if (weekday) details.weekday = weekday;
  if (weekend) details.weekend = weekend;
  if (typeof data.stopsVerified !== 'boolean') {
    throw new MinibusDirectoryError(`${label} durak doğrulama değeri boolean olmalıdır.`);
  }
  return {
    sourceId: sourceId(data.sourceId),
    details,
    outboundRoute: routePoints(data.outboundRoute, `${label} gidiş güzergâhı`),
    returnRoute: routePoints(data.returnRoute, `${label} dönüş güzergâhı`),
    schedule: scheduleValue(data.schedule, `${label} sefer çizelgesi`),
    stops: stopsValue(data.stops, `${label} durakları`),
    stopsVerified: data.stopsVerified,
    ...(data.syncedAt === undefined ? {} : { syncedAt: textValue(data.syncedAt, `${label} senkron zamanı`) }),
    errors: data.errors === undefined ? [] : stringArray(data.errors, `${label} senkron hataları`),
  };
}

export function parseMinibusDirectoryPayload(payload: unknown): MinibusDistrict[] {
  const root = objectValue(payload, 'Minibüs dizini');
  if (root.version !== 1) {
    throw new MinibusDirectoryError('Desteklenmeyen minibüs dizini sürümü.');
  }
  if (!Array.isArray(root.cities)) {
    throw new MinibusDirectoryError('Minibüs şehirleri bir dizi olmalıdır.');
  }

  const districts: MinibusDistrict[] = [];
  const citySlugs = new Set<string>();

  for (const rawCity of root.cities) {
    const city = objectValue(rawCity, 'Minibüs şehri');
    const cityId = positiveInteger(city.id, 'Şehir ID');
    const cityName = textValue(city.name, 'Şehir adı');
    const citySlug = slugify(textValue(city.slug, 'Şehir slug'));
    if (!citySlug) throw new MinibusDirectoryError('Şehir slug geçersiz.');
    if (citySlugs.has(citySlug)) {
      throw new MinibusDirectoryError(`Yinelenen şehir slug: ${citySlug}`);
    }
    citySlugs.add(citySlug);

    if (!Array.isArray(city.districts)) {
      throw new MinibusDirectoryError(`${cityName} ilçeleri bir dizi olmalıdır.`);
    }
    const districtSlugs = new Set<string>();

    for (const rawDistrict of city.districts) {
      const district = objectValue(rawDistrict, 'Minibüs ilçesi');
      const id = positiveInteger(district.id, 'İlçe ID');
      const name = textValue(district.name, 'İlçe adı');
      const slug = slugify(textValue(district.slug, 'İlçe slug'));
      if (!slug) throw new MinibusDirectoryError('İlçe slug geçersiz.');
      if (citySlug === 'istanbul' && ISTANBUL_DISTRICT_BY_SLUG.get(slug) !== name) {
        throw new MinibusDirectoryError(`${name} İstanbul için doğrulanmış bir idari ilçe değildir.`);
      }
      if (districtSlugs.has(slug)) {
        throw new MinibusDirectoryError(`${cityName} içinde yinelenen ilçe slug: ${slug}`);
      }
      districtSlugs.add(slug);

      if (!Array.isArray(district.sourceIds)) {
        throw new MinibusDirectoryError(`${name} minibüs kaynak kimlikleri bir dizi olmalıdır.`);
      }
      const sourceIds = [...new Set(district.sourceIds.map(sourceId))];
      const lineIds = integerArray(district.lineIds, `${name} hat ID'leri`);

      districts.push({
        id,
        name,
        slug,
        cityId,
        cityName,
        citySlug,
        sourceIds,
        lineIds,
      });
    }
  }

  return districts;
}

export function parseMinibusEditorialLinesPayload(payload: unknown): MinibusEditorialLine[] {
  const root = objectValue(payload, 'Minibüs dizini');
  if (root.version !== 1) {
    throw new MinibusDirectoryError('Desteklenmeyen minibüs dizini sürümü.');
  }
  if (!Array.isArray(root.cities)) {
    throw new MinibusDirectoryError('Minibüs şehirleri bir dizi olmalıdır.');
  }

  const lines: MinibusEditorialLine[] = [];
  const citySlugs = new Set<string>();

  for (const rawCity of root.cities) {
    const city = objectValue(rawCity, 'Minibüs şehri');
    const cityId = positiveInteger(city.id, 'Şehir ID');
    const cityName = textValue(city.name, 'Şehir adı');
    const citySlug = slugify(textValue(city.slug, 'Şehir slug'));
    if (!citySlug) throw new MinibusDirectoryError('Şehir slug geçersiz.');
    if (citySlugs.has(citySlug)) {
      throw new MinibusDirectoryError(`Yinelenen şehir slug: ${citySlug}`);
    }
    citySlugs.add(citySlug);

    if (city.lines === undefined) continue;
    if (!Array.isArray(city.lines)) {
      throw new MinibusDirectoryError(`${cityName} editoryal hatları bir dizi olmalıdır.`);
    }

    const lineSlugs = new Set<string>();
    for (const rawLine of city.lines) {
      const line = objectValue(rawLine, 'Minibüs editoryal hattı');
      const id = positiveInteger(line.id, 'Hat ID');
      const categoryId = positiveInteger(line.categoryId, 'Hat kategori ID');
      const code = textValue(line.code, 'Hat kodu');
      const name = textValue(line.name, 'Hat adı');
      const slug = slugify(textValue(line.slug, 'Hat slug'));
      if (!slug) throw new MinibusDirectoryError('Hat slug geçersiz.');
      if (lineSlugs.has(slug)) {
        throw new MinibusDirectoryError(`${cityName} içinde yinelenen hat slug: ${slug}`);
      }
      lineSlugs.add(slug);
      if (!Array.isArray(line.sourceIds) || line.sourceIds.length === 0) {
        throw new MinibusDirectoryError(`${name} minibüs kaynak kimlikleri boş olamaz.`);
      }
      if (typeof line.infoHtml !== 'string') {
        throw new MinibusDirectoryError(`${name} bilgi metni bir dize olmalıdır.`);
      }
      if (line.vehicleType !== 'minibus' && line.vehicleType !== 'taksi-dolmus') {
        throw new MinibusDirectoryError(`${name} araç türü tanınmıyor.`);
      }

      lines.push({
        id,
        categoryId,
        code,
        name,
        slug,
        cityId,
        cityName,
        citySlug,
        sourceIds: [...new Set(line.sourceIds.map(sourceId))],
        vehicleType: line.vehicleType,
        infoHtml: line.infoHtml,
        data: cachedDataValue(line.data, name),
      });
    }
  }

  return lines;
}

export function parseMinibusCachedLinePayload(payload: unknown): MinibusEditorialLine {
  const root = objectValue(payload, 'Minibüs hat detayı');
  if (root.version !== 1) {
    throw new MinibusDirectoryError('Desteklenmeyen minibüs hat detayı sürümü.');
  }
  const city = objectValue(root.city, 'Minibüs hat şehri');
  const lines = parseMinibusEditorialLinesPayload({
    version: 1,
    cities: [{
      id: city.id,
      name: city.name,
      slug: city.slug,
      districts: [],
      lines: [root.line],
    }],
  });
  if (lines.length !== 1) {
    throw new MinibusDirectoryError('Minibüs hat detayı bulunamadı.');
  }
  return lines[0];
}

export function toMinibusLineCatalog(lines: MinibusEditorialLine[]): MinibusLine[] {
  return lines.map((line) => ({
    code: line.code,
    name: line.name,
    slug: line.slug,
    vehicleType: line.vehicleType,
    vehicleTypeLabel: line.vehicleType === 'minibus' ? 'Minibüs' : 'Taksi dolmuş',
    sourceIds: [...line.sourceIds],
    infoHtml: line.infoHtml,
    cachedData: line.data,
  }));
}

export function findMinibusEditorialLine(
  lines: MinibusEditorialLine[],
  cityValue: string,
  officialLine: MinibusLine,
): MinibusEditorialLine | null {
  const citySlug = slugify(cityValue);
  const officialSourceIds = new Set(officialLine.sourceIds.map(sourceId));
  const matches = lines.filter((line) => (
    line.citySlug === citySlug
    && line.sourceIds.some((id) => officialSourceIds.has(sourceId(id)))
  ));
  return matches.find((line) => line.slug === officialLine.slug)
    ?? matches.sort((left, right) => left.id - right.id)[0]
    ?? null;
}

export function hasMeaningfulMinibusInfo(html: string | null | undefined): boolean {
  if (!html) return false;
  const visibleText = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|#160|#x0*a0);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return visibleText.length > 0;
}

export function parseMinibusCategoryInfoPayload(payload: unknown, categorySlug: string): string {
  if (!Array.isArray(payload)) return '';
  const expectedSlug = slugify(categorySlug);
  if (!expectedSlug) return '';

  for (const rawCategory of payload) {
    if (!rawCategory || typeof rawCategory !== 'object' || Array.isArray(rawCategory)) continue;
    const category = rawCategory as Record<string, unknown>;
    if (typeof category.slug !== 'string' || slugify(category.slug) !== expectedSlug) continue;
    return typeof category.description === 'string' ? category.description.trim() : '';
  }
  return '';
}

export function findMinibusDistrict(
  districts: MinibusDistrict[],
  cityValue: string,
  districtValue: string,
): MinibusDistrict | null {
  const citySlug = slugify(cityValue);
  const districtSlug = slugify(districtValue);
  return districts.find((district) => (
    district.citySlug === citySlug && district.slug === districtSlug
  )) ?? null;
}

export function filterMinibusLinesForDistrict(
  lines: MinibusLine[],
  district: MinibusDistrict,
): MinibusLine[] {
  const allowedSourceIds = new Set(district.sourceIds.map(sourceId));
  return lines.filter((line) => line.sourceIds.some((id) => allowedSourceIds.has(sourceId(id))));
}

export function mergeMinibusDistrictCatalogs(
  snapshot: MinibusDistrict[],
  cms: MinibusDistrict[],
): MinibusDistrict[] {
  const merged = new Map<string, MinibusDistrict>();
  for (const district of snapshot) {
    merged.set(`${district.citySlug}/${district.slug}`, district);
  }
  for (const district of cms) {
    const key = `${district.citySlug}/${district.slug}`;
    const snapshotDistrict = merged.get(key);
    const cmsHasVerifiedRelations = district.sourceIds.length > 0;
    if (snapshotDistrict && !cmsHasVerifiedRelations) continue;
    merged.set(key, district);
  }
  return [...merged.values()].sort((left, right) => (
    left.cityName.localeCompare(right.cityName, 'tr')
    || left.name.localeCompare(right.name, 'tr')
  ));
}

export function buildMinibusDistrictEntries(
  lines: MinibusLine[] | null,
  districts: MinibusDistrict[],
): Array<{ district: MinibusDistrict; lineCount: number | null }> {
  return districts.map((district) => ({
    district,
    lineCount: lines ? filterMinibusLinesForDistrict(lines, district).length : null,
  }));
}

export function buildMinibusCityLandingEntries(
  districts: MinibusDistrict[],
  cityValue: string,
): Array<{ district: MinibusDistrict; lineCount: number }> {
  const citySlug = slugify(cityValue);
  return districts
    .filter((district) => district.citySlug === citySlug)
    .map((district) => ({
      district,
      lineCount: district.sourceIds.length,
    }));
}

export type MinibusDirectoryRoute =
  | { kind: 'district'; district: MinibusDistrict }
  | { kind: 'line'; line: MinibusLine }
  | { kind: 'not-found' };

export type MinibusDistrictLoad =
  | { status: 'ready'; districts: MinibusDistrict[] }
  | { status: 'error'; error: unknown };

export function resolveMinibusDistrictLoad(
  result: PromiseSettledResult<MinibusDistrict[]>,
): MinibusDistrictLoad {
  return result.status === 'fulfilled'
    ? { status: 'ready', districts: result.value }
    : { status: 'error', error: result.reason };
}

export function resolveMinibusDirectoryRoute(
  districts: MinibusDistrict[],
  lines: MinibusLine[],
  cityValue: string,
  slugValue: string,
): MinibusDirectoryRoute {
  const district = findMinibusDistrict(districts, cityValue, slugValue);
  if (district) return { kind: 'district', district };

  const slug = slugify(slugValue);
  const line = lines.find((candidate) => candidate.slug === slug);
  return line ? { kind: 'line', line } : { kind: 'not-found' };
}
