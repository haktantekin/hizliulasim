import type { MinibusLine } from './minibusData.ts';
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
