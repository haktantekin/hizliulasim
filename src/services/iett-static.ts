import type { IETTDurak, IETTDurakDetay, IETTHat, IETTPlanlananSefer } from '../types/iett.ts';
import {
  IettStaticSourceError,
  loadIettStaticDirectory,
  loadIettStaticLine,
  loadIettStaticStop,
  type LoadedIettStaticResource,
} from '../lib/iett-static/source.ts';
import { normalizeIettStaticCode } from '../lib/iett-static/contracts.ts';

export type IettStaticDataSource = 'current' | 'previous' | 'legacy';

export interface IettStaticMetadata {
  source: IettStaticDataSource;
  version: string | null;
  generatedAt: string | null;
}

export interface IettStaticResult<T> {
  data: T;
  metadata: IettStaticMetadata;
}

export interface IettPassingLine {
  hatKodu: string;
  hatAdi: string;
  yon: string;
  sirano: number;
}

export interface IettNearestStop {
  durakKodu: string;
  durakAdi: string;
  ilceAdi: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

interface Dependencies {
  loadDirectory: typeof loadIettStaticDirectory;
  loadLine: typeof loadIettStaticLine;
  loadStop: typeof loadIettStaticStop;
  legacyGetHat(code?: string): Promise<IETTHat[]>;
  legacyGetDurak(code?: string): Promise<IETTDurak[]>;
  legacyGetDurakDetay(code: string, timeoutMs?: number): Promise<IETTDurakDetay[]>;
  legacyGetHatlarByDurak(code: string): Promise<IettPassingLine[]>;
  legacyGetSchedules(code: string): Promise<IETTPlanlananSefer[]>;
}

const defaultDependencies: Dependencies = {
  loadDirectory: loadIettStaticDirectory,
  loadLine: loadIettStaticLine,
  loadStop: loadIettStaticStop,
  legacyGetHat: async (code = '') => (await import('./iett.ts')).getHat(code),
  legacyGetDurak: async (code = '') => (await import('./iett.ts')).getDurak(code),
  legacyGetDurakDetay: async (code, timeoutMs) => (await import('./iett.ts')).getDurakDetay(code, timeoutMs),
  legacyGetHatlarByDurak: async (code) => (await import('./iett.ts')).getHatlarByDurak(code),
  legacyGetSchedules: async (code) => (await import('./iett.ts')).getPlanlananSeferSaati(code),
};

const legacyCacheTtlMs = 5 * 60 * 1000;

function localResult<Resource, Data>(resource: LoadedIettStaticResource<Resource>, data: Data): IettStaticResult<Data> {
  return {
    data,
    metadata: {
      source: resource.usedFallback ? 'previous' : 'current',
      version: resource.version,
      generatedAt: resource.generatedAt,
    },
  };
}

function legacyResult<T>(data: T): IettStaticResult<T> {
  return { data, metadata: { source: 'legacy', version: null, generatedAt: null } };
}

function normalizeSearch(value: string): string {
  return value.toLocaleUpperCase('tr-TR').replace(/[^0-9A-ZÇĞİÖŞÜ]/gu, '');
}

export function filterIettHatlar(lines: readonly IETTHat[], query: string): IETTHat[] {
  const text = query.toLocaleUpperCase('tr-TR').trim();
  const normalized = normalizeSearch(query);
  if (!normalized) return [...lines];
  return lines.filter((line) => {
    const code = line.SHATKODU.toLocaleUpperCase('tr-TR');
    const name = line.SHATADI.toLocaleUpperCase('tr-TR');
    return code.includes(text) || name.includes(text)
      || normalizeSearch(line.SHATKODU).includes(normalized)
      || normalizeSearch(line.SHATADI).includes(normalized);
  });
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitude = radians(lat2 - lat1);
  const longitude = radians(lon2 - lon1);
  const value = Math.sin(latitude / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function createIettStaticService(dependencies: Partial<Dependencies> = {}) {
  const deps: Dependencies = { ...defaultDependencies, ...dependencies };
  const legacyCache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

  async function cachedLegacy<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = legacyCache.get(key);
    if (cached && cached.expiresAt > now) return cached.promise as Promise<T>;
    const promise = loader();
    legacyCache.set(key, { expiresAt: now + legacyCacheTtlMs, promise });
    try {
      return await promise;
    } catch (error) {
      if (legacyCache.get(key)?.promise === promise) legacyCache.delete(key);
      throw error;
    }
  }

  async function localFirst<T>(local: () => Promise<IettStaticResult<T>>, legacy: () => Promise<T>): Promise<IettStaticResult<T>> {
    try {
      return await local();
    } catch (error) {
      if (!(error instanceof IettStaticSourceError)) throw error;
      return legacyResult(await legacy());
    }
  }

  return {
    async getHatlar({ code, query }: { code?: string; query?: string }): Promise<IettStaticResult<IETTHat[]>> {
      const normalized = code === undefined ? null : normalizeIettStaticCode(code);
      if (code !== undefined && normalized === null) return legacyResult([]);
      return localFirst(async () => {
        if (normalized !== null) {
          const line = await deps.loadLine(normalized);
          if (line !== null) return localResult(line, [line.data.line]);
          const directory = await deps.loadDirectory();
          return localResult(directory, [] as IETTHat[]);
        }
        const directory = await deps.loadDirectory();
        const lines = query === undefined ? directory.data.lines : filterIettHatlar(directory.data.lines, query);
        return localResult(directory, lines);
      }, async () => {
        const lines = await cachedLegacy(`hatlar:${normalized ?? '*'}`, () => deps.legacyGetHat(normalized ?? ''));
        return query === undefined ? lines : filterIettHatlar(lines, query);
      });
    },

    async getSchedules(code: string): Promise<IettStaticResult<IETTPlanlananSefer[]>> {
      const normalized = normalizeIettStaticCode(code);
      if (normalized === null) return legacyResult([]);
      return localFirst(async () => {
        const line = await deps.loadLine(normalized);
        if (line !== null) return localResult(line, line.data.schedules);
        return localResult(await deps.loadDirectory(), [] as IETTPlanlananSefer[]);
      }, () => cachedLegacy(`schedules:${normalized}`, () => deps.legacyGetSchedules(normalized)));
    },

    async getRouteStops(code: string): Promise<IettStaticResult<IETTDurakDetay[]>> {
      const normalized = normalizeIettStaticCode(code);
      if (normalized === null) return legacyResult([]);
      return localFirst(async () => {
        const line = await deps.loadLine(normalized);
        if (line !== null) return localResult(line, line.data.stops);
        return localResult(await deps.loadDirectory(), [] as IETTDurakDetay[]);
      }, () => cachedLegacy(`route-stops:${normalized}`, () => deps.legacyGetDurakDetay(normalized)));
    },

    async getStop(code: string): Promise<IettStaticResult<IETTDurak | null>> {
      if (!/^[0-9]{1,12}$/.test(code)) return legacyResult(null);
      return localFirst(async () => {
        const stop = await deps.loadStop(code);
        if (stop !== null) return localResult(stop, stop.data.stop);
        return localResult(await deps.loadDirectory(), null as IETTDurak | null);
      }, async () => (await cachedLegacy(`stop:${code}`, () => deps.legacyGetDurak(code)))[0] ?? null);
    },

    async getLinesByStop(code: string): Promise<IettStaticResult<IettPassingLine[]>> {
      if (!/^[0-9]{1,12}$/.test(code)) return legacyResult([]);
      return localFirst(async () => {
        const stop = await deps.loadStop(code);
        if (stop !== null) return localResult(stop, stop.data.lines);
        return localResult(await deps.loadDirectory(), [] as IettPassingLine[]);
      }, () => cachedLegacy(`stop-lines:${code}`, () => deps.legacyGetHatlarByDurak(code)));
    },

    async getNearestStop(lat: number, lng: number): Promise<IettStaticResult<IettNearestStop | null>> {
      return localFirst(async () => {
        const directory = await deps.loadDirectory();
        let nearest: IettNearestStop | null = null;
        for (const stop of directory.data.stops) {
          const distanceMeters = haversineDistance(lat, lng, stop.YKOORDINATI, stop.XKOORDINATI);
          if (nearest === null || distanceMeters < nearest.distanceMeters) {
            nearest = {
              durakKodu: stop.SDPICARETNO, durakAdi: stop.SDURAKADI, ilceAdi: stop.ILCEADI,
              lat: stop.YKOORDINATI, lng: stop.XKOORDINATI, distanceMeters,
            };
          }
        }
        return localResult(directory, nearest);
      }, async () => {
        const stops = await cachedLegacy('all-route-stops', () => deps.legacyGetDurakDetay('', 90_000));
        const unique = new Map<string, IETTDurakDetay>();
        for (const stop of stops) if (stop.DURAKKODU && !unique.has(stop.DURAKKODU)) unique.set(stop.DURAKKODU, stop);
        let nearest: IettNearestStop | null = null;
        for (const stop of unique.values()) {
          const distanceMeters = haversineDistance(lat, lng, stop.YKOORDINATI, stop.XKOORDINATI);
          if (nearest === null || distanceMeters < nearest.distanceMeters) {
            nearest = {
              durakKodu: stop.DURAKKODU, durakAdi: stop.DURAKADI, ilceAdi: stop.ILCEADI,
              lat: stop.YKOORDINATI, lng: stop.XKOORDINATI, distanceMeters,
            };
          }
        }
        return nearest;
      });
    },
  };
}

const service = createIettStaticService();

export const getStaticHatlar = service.getHatlar;
export const getStaticSchedules = service.getSchedules;
export const getStaticRouteStops = service.getRouteStops;
export const getStaticStop = service.getStop;
export const getStaticLinesByStop = service.getLinesByStop;
export const getStaticNearestStop = service.getNearestStop;

export function iettStaticResponseHeaders(metadata: IettStaticMetadata): Record<string, string> {
  return {
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'X-Hizliulasim-Data-Source': `iett-${metadata.source}`,
    ...(metadata.version === null ? {} : { 'X-Hizliulasim-Data-Version': metadata.version }),
    ...(metadata.generatedAt === null ? {} : { 'X-Hizliulasim-Data-Generated-At': metadata.generatedAt }),
  };
}
