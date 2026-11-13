import type { IETTDurak, IETTDurakDetay, IETTHat, IETTPlanlananSefer } from '../types/iett.ts';
import {
  loadIettStaticDirectory,
  loadIettStaticLine,
  loadIettStaticStop,
  type LoadedIettStaticResource,
} from '../lib/iett-static/source.ts';
import { normalizeIettStaticCode, type IettStaticPath } from '../lib/iett-static/contracts.ts';

export type IettStaticDataSource = 'current' | 'previous';

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
}

const defaultDependencies: Dependencies = {
  loadDirectory: loadIettStaticDirectory,
  loadLine: loadIettStaticLine,
  loadStop: loadIettStaticStop,
};

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

function emptyResult<T>(data: T): IettStaticResult<T> {
  return { data, metadata: { source: 'current', version: null, generatedAt: null } };
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

  async function lineData<T>(code: string, pick: (line: NonNullable<Awaited<ReturnType<Dependencies['loadLine']>>>['data']) => T, empty: T) {
    const normalized = normalizeIettStaticCode(code);
    if (normalized === null) return emptyResult(empty);
    const line = await deps.loadLine(normalized);
    if (line !== null) return localResult(line, pick(line.data));
    return localResult(await deps.loadDirectory(), empty);
  }

  return {
    async getHatlar({ code, query }: { code?: string; query?: string }): Promise<IettStaticResult<IETTHat[]>> {
      const normalized = code === undefined ? null : normalizeIettStaticCode(code);
      if (code !== undefined && normalized === null) return emptyResult([]);
      if (normalized !== null) {
        const line = await deps.loadLine(normalized);
        if (line !== null) return localResult(line, [line.data.line]);
        return localResult(await deps.loadDirectory(), [] as IETTHat[]);
      }
      const directory = await deps.loadDirectory();
      const lines = query === undefined ? directory.data.lines : filterIettHatlar(directory.data.lines, query);
      return localResult(directory, lines);
    },

    getSchedules(code: string): Promise<IettStaticResult<IETTPlanlananSefer[]>> {
      return lineData(code, (line) => line.schedules, [] as IETTPlanlananSefer[]);
    },

    getRouteStops(code: string): Promise<IettStaticResult<IETTDurakDetay[]>> {
      return lineData(code, (line) => line.stops, [] as IETTDurakDetay[]);
    },

    getPaths(code: string): Promise<IettStaticResult<IettStaticPath[]>> {
      return lineData(code, (line) => line.paths ?? [], [] as IettStaticPath[]);
    },

    async getStop(code: string): Promise<IettStaticResult<IETTDurak | null>> {
      if (!/^[0-9]{1,12}$/.test(code)) return emptyResult(null);
      const stop = await deps.loadStop(code);
      if (stop !== null) return localResult(stop, stop.data.stop);
      return localResult(await deps.loadDirectory(), null as IETTDurak | null);
    },

    async getLinesByStop(code: string): Promise<IettStaticResult<IettPassingLine[]>> {
      if (!/^[0-9]{1,12}$/.test(code)) return emptyResult([]);
      const stop = await deps.loadStop(code);
      if (stop !== null) return localResult(stop, stop.data.lines);
      return localResult(await deps.loadDirectory(), [] as IettPassingLine[]);
    },

    async getNearestStop(lat: number, lng: number): Promise<IettStaticResult<IettNearestStop | null>> {
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
    },
  };
}

const service = createIettStaticService();

export const getStaticHatlar = service.getHatlar;
export const getStaticSchedules = service.getSchedules;
export const getStaticRouteStops = service.getRouteStops;
export const getStaticPaths = service.getPaths;
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
