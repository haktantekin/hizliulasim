import { createHash } from 'node:crypto';
import type { IETTDurak, IETTDurakDetay, IETTHat, IETTPlanlananSefer } from '../../types/iett.ts';

export interface IettStaticPointer {
  version: string;
  manifestSha256: string;
}

export interface IettStaticFileMetadata {
  bytes: number;
  sha256: string;
}

export interface IettStaticSourceArtifact {
  url: string;
  retrievedAt: string;
  bytes: number;
  sha256: string;
}

export interface IettStaticManifest {
  schemaVersion: 1;
  version: string;
  generatedAt: string;
  serviceDateRange: { start: string; end: string };
  source: {
    lines: IettStaticSourceArtifact;
    stops: IettStaticSourceArtifact;
    transit: IettStaticPointer;
  };
  counts: { lines: number; schedules: number; lineStops: number; stops: number };
  files: Record<string, IettStaticFileMetadata>;
  indexes: {
    directory: 'directory.json.gz';
    lines: Record<string, string>;
    stops: Record<string, string>;
  };
}

export interface IettStaticDirectory {
  schemaVersion: 1;
  generatedAt: string;
  lines: IETTHat[];
}

export interface IettStaticLine {
  schemaVersion: 1;
  generatedAt: string;
  line: IETTHat;
  schedules: IETTPlanlananSefer[];
  stops: IETTDurakDetay[];
}

export interface IettStaticPassingLine {
  hatKodu: string;
  hatAdi: string;
  yon: 'D' | 'G';
  sirano: number;
}

export interface IettStaticStop {
  schemaVersion: 1;
  generatedAt: string;
  stop: IETTDurak;
  lines: IettStaticPassingLine[];
}

const versionPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const filePathPattern = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
const lineCodePattern = /^[0-9A-ZÇĞİÖŞÜ-]{1,32}$/u;
const stopCodePattern = /^[0-9]{1,12}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[0-6]\d|7[01]):[0-5]\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isString(value: unknown, { nonempty = false }: { nonempty?: boolean } = {}): value is string {
  return typeof value === 'string' && (!nonempty || (value.length > 0 && value.trim() === value));
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && sha256Pattern.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNonnegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isDateRange(value: unknown): value is { start: string; end: string } {
  if (!isRecord(value) || !hasExactKeys(value, ['start', 'end'])
    || typeof value.start !== 'string' || typeof value.end !== 'string'
    || !datePattern.test(value.start) || !datePattern.test(value.end)) return false;
  const start = Date.parse(`${value.start}T00:00:00Z`);
  const end = Date.parse(`${value.end}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && start <= end;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function normalizeIettStaticCode(value: string): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLocaleUpperCase('tr-TR');
  return lineCodePattern.test(normalized) ? normalized : null;
}

function normalizeStopCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() !== value) return null;
  return stopCodePattern.test(value) ? value : null;
}

function isSourceArtifact(value: unknown): value is IettStaticSourceArtifact {
  if (!isRecord(value) || !hasExactKeys(value, ['url', 'retrievedAt', 'bytes', 'sha256'])
    || typeof value.url !== 'string' || !isInstant(value.retrievedAt)
    || !isPositiveInteger(value.bytes) || !isSha256(value.sha256)) return false;
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' && url.hostname === 'api.ibb.gov.tr'
      && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function parseIettStaticPointer(value: unknown): IettStaticPointer {
  if (!isRecord(value) || !hasExactKeys(value, ['version', 'manifestSha256'])
    || typeof value.version !== 'string' || !versionPattern.test(value.version)
    || !isSha256(value.manifestSha256)) throw new TypeError('Invalid İETT static pointer');
  return { version: value.version, manifestSha256: value.manifestSha256 };
}

function isFileMetadata(value: unknown): value is IettStaticFileMetadata {
  return isRecord(value) && hasExactKeys(value, ['bytes', 'sha256'])
    && isPositiveInteger(value.bytes) && isSha256(value.sha256);
}

function parseIndex(value: unknown, folder: 'lines' | 'stops', files: Record<string, IettStaticFileMetadata>): Record<string, string> {
  if (!isRecord(value) || Object.keys(value).length === 0) throw new TypeError(`Invalid ${folder} index`);
  const parsed: Record<string, string> = {};
  for (const [rawCode, rawPath] of Object.entries(value)) {
    const code = folder === 'lines' ? normalizeIettStaticCode(rawCode) : normalizeStopCode(rawCode);
    const expected = code === null ? null : `${folder}/${hashCode(code)}.json.gz`;
    if (code !== rawCode || typeof rawPath !== 'string' || rawPath !== expected || !Object.hasOwn(files, rawPath)) {
      throw new TypeError(`Invalid ${folder} index entry`);
    }
    parsed[code] = rawPath;
  }
  return parsed;
}

export function parseIettStaticManifest(value: unknown): IettStaticManifest {
  const topKeys = ['schemaVersion', 'version', 'generatedAt', 'serviceDateRange', 'source', 'counts', 'files', 'indexes'];
  if (!isRecord(value) || !hasExactKeys(value, topKeys) || value.schemaVersion !== 1
    || typeof value.version !== 'string' || !versionPattern.test(value.version)
    || !isInstant(value.generatedAt) || !isDateRange(value.serviceDateRange)
    || !isRecord(value.source) || !hasExactKeys(value.source, ['lines', 'stops', 'transit'])
    || !isSourceArtifact(value.source.lines) || !isSourceArtifact(value.source.stops)) {
    throw new TypeError('Invalid İETT static manifest metadata');
  }
  const transit = parseIettStaticPointer(value.source.transit);
  if (!isRecord(value.counts) || !hasExactKeys(value.counts, ['lines', 'schedules', 'lineStops', 'stops'])
    || !Object.values(value.counts).every(isNonnegativeInteger)
    || !isRecord(value.files) || Object.keys(value.files).length === 0
    || !Object.entries(value.files).every(([path, metadata]) => filePathPattern.test(path) && isFileMetadata(metadata))
    || !isRecord(value.indexes) || !hasExactKeys(value.indexes, ['directory', 'lines', 'stops'])
    || value.indexes.directory !== 'directory.json.gz' || !Object.hasOwn(value.files, value.indexes.directory)) {
    throw new TypeError('Invalid İETT static manifest inventory');
  }
  const files = value.files as Record<string, IettStaticFileMetadata>;
  const lines = parseIndex(value.indexes.lines, 'lines', files);
  const stops = parseIndex(value.indexes.stops, 'stops', files);
  if (value.counts.lines !== Object.keys(lines).length || value.counts.stops !== Object.keys(stops).length) {
    throw new TypeError('Invalid İETT static manifest counts');
  }
  const referenced = new Set([value.indexes.directory, ...Object.values(lines), ...Object.values(stops)]);
  if (referenced.size !== Object.keys(files).length || Object.keys(files).some((path) => !referenced.has(path))) {
    throw new TypeError('İETT static manifest contains unreferenced files');
  }
  return {
    schemaVersion: 1,
    version: value.version,
    generatedAt: value.generatedAt,
    serviceDateRange: value.serviceDateRange,
    source: { lines: value.source.lines, stops: value.source.stops, transit },
    counts: value.counts as IettStaticManifest['counts'],
    files,
    indexes: { directory: 'directory.json.gz', lines, stops },
  };
}

function isLine(value: unknown): value is IETTHat {
  return isRecord(value) && hasExactKeys(value, ['SHATKODU', 'SHATADI', 'TARIFE', 'HAT_UZUNLUGU', 'SEFER_SURESI'])
    && normalizeIettStaticCode(value.SHATKODU as string) === value.SHATKODU
    && isString(value.SHATADI, { nonempty: true }) && isString(value.TARIFE)
    && isNonnegativeNumber(value.HAT_UZUNLUGU) && isNonnegativeNumber(value.SEFER_SURESI);
}

function parseEnvelope(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!isRecord(value) || !hasExactKeys(value, keys) || value.schemaVersion !== 1 || !isInstant(value.generatedAt)) {
    throw new TypeError('Invalid İETT static payload envelope');
  }
}

export function parseIettStaticDirectory(value: unknown): IettStaticDirectory {
  parseEnvelope(value, ['schemaVersion', 'generatedAt', 'lines']);
  if (!Array.isArray(value.lines) || value.lines.length === 0 || !value.lines.every(isLine)) {
    throw new TypeError('Invalid İETT static directory lines');
  }
  const codes = value.lines.map((entry) => entry.SHATKODU);
  if (new Set(codes).size !== codes.length) throw new TypeError('Duplicate İETT static directory line');
  return value as unknown as IettStaticDirectory;
}

function isSchedule(value: unknown, code: string): value is IETTPlanlananSefer {
  return isRecord(value)
    && hasExactKeys(value, ['SHATKODU', 'HATADI', 'SGUZERAH', 'SYON', 'SGUNTIPI', 'GUZERGAH_ISARETI', 'SSERVISTIPI', 'DT'])
    && value.SHATKODU === code && isString(value.HATADI, { nonempty: true })
    && isString(value.SGUZERAH, { nonempty: true }) && (value.SYON === 'D' || value.SYON === 'G')
    && (value.SGUNTIPI === 'C' || value.SGUNTIPI === 'I' || value.SGUNTIPI === 'P')
    && (value.GUZERGAH_ISARETI === null || isString(value.GUZERGAH_ISARETI))
    && isString(value.SSERVISTIPI) && typeof value.DT === 'string' && timePattern.test(value.DT);
}

function isRouteStop(value: unknown, code: string): value is IETTDurakDetay {
  const keys = ['HATKODU', 'YON', 'YON_ADI', 'SIRANO', 'DURAKKODU', 'DURAKADI', 'XKOORDINATI', 'YKOORDINATI',
    'DURAKTIPI', 'ISLETMEBOLGE', 'ISLETMEALTBOLGE', 'ILCEADI'];
  return isRecord(value) && hasExactKeys(value, keys) && value.HATKODU === code
    && (value.YON === 'D' || value.YON === 'G') && isString(value.YON_ADI, { nonempty: true })
    && isPositiveInteger(value.SIRANO) && normalizeStopCode(value.DURAKKODU) !== null
    && isString(value.DURAKADI, { nonempty: true })
    && typeof value.XKOORDINATI === 'number' && Number.isFinite(value.XKOORDINATI)
    && value.XKOORDINATI >= 26 && value.XKOORDINATI <= 31
    && typeof value.YKOORDINATI === 'number' && Number.isFinite(value.YKOORDINATI)
    && value.YKOORDINATI >= 39.5 && value.YKOORDINATI <= 42.5
    && isString(value.DURAKTIPI) && isString(value.ISLETMEBOLGE)
    && isString(value.ISLETMEALTBOLGE) && isString(value.ILCEADI);
}

export function parseIettStaticLine(value: unknown): IettStaticLine {
  parseEnvelope(value, ['schemaVersion', 'generatedAt', 'line', 'schedules', 'stops']);
  const parsedLine = value.line;
  if (!isLine(parsedLine) || !Array.isArray(value.schedules) || !Array.isArray(value.stops)
    || !value.schedules.every((entry) => isSchedule(entry, parsedLine.SHATKODU))
    || !value.stops.every((entry) => isRouteStop(entry, parsedLine.SHATKODU))) {
    throw new TypeError('Invalid İETT static line payload');
  }
  const scheduleKeys = value.schedules.map((entry) => [entry.SYON, entry.SGUNTIPI, entry.SGUZERAH, entry.DT].join('|'));
  const stopKeys = value.stops.map((entry) => [entry.YON, entry.SIRANO, entry.DURAKKODU].join('|'));
  if (new Set(scheduleKeys).size !== scheduleKeys.length || new Set(stopKeys).size !== stopKeys.length) {
    throw new TypeError('Duplicate İETT static line record');
  }
  return value as unknown as IettStaticLine;
}

function isStop(value: unknown): value is IETTDurak {
  const keys = ['SDPICARETNO', 'SDURAKADI', 'KOORDINAT', 'ILCEADI', 'SPICARETNO', 'YKOORDINATI', 'XKOORDINATI',
    'DURAKTIPI', 'ENGELLIKULLANIMI', 'AKPICARETNO', 'BOLESSION'];
  return isRecord(value) && hasExactKeys(value, keys) && normalizeStopCode(value.SDPICARETNO) !== null
    && isString(value.SDURAKADI, { nonempty: true }) && isString(value.KOORDINAT) && isString(value.ILCEADI)
    && isString(value.SPICARETNO) && typeof value.YKOORDINATI === 'number' && Number.isFinite(value.YKOORDINATI)
    && value.YKOORDINATI >= 39.5 && value.YKOORDINATI <= 42.5
    && typeof value.XKOORDINATI === 'number' && Number.isFinite(value.XKOORDINATI)
    && value.XKOORDINATI >= 26 && value.XKOORDINATI <= 31
    && isString(value.DURAKTIPI) && isString(value.ENGELLIKULLANIMI)
    && isString(value.AKPICARETNO) && isString(value.BOLESSION);
}

function isPassingLine(value: unknown): value is IettStaticPassingLine {
  return isRecord(value) && hasExactKeys(value, ['hatKodu', 'hatAdi', 'yon', 'sirano'])
    && normalizeIettStaticCode(value.hatKodu as string) === value.hatKodu
    && isString(value.hatAdi, { nonempty: true }) && (value.yon === 'D' || value.yon === 'G')
    && isPositiveInteger(value.sirano);
}

export function parseIettStaticStop(value: unknown): IettStaticStop {
  parseEnvelope(value, ['schemaVersion', 'generatedAt', 'stop', 'lines']);
  if (!isStop(value.stop) || !Array.isArray(value.lines) || !value.lines.every(isPassingLine)) {
    throw new TypeError('Invalid İETT static stop payload');
  }
  const keys = value.lines.map((entry) => [entry.hatKodu, entry.yon, entry.sirano].join('|'));
  if (new Set(keys).size !== keys.length) throw new TypeError('Duplicate İETT static stop line');
  return value as unknown as IettStaticStop;
}
