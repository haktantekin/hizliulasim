import { createHash } from 'node:crypto';
import { routeSearchBounds } from './route-search-area.ts';

export const TRANSIT_SCHEMA_VERSION = 1;
export const MAX_ROUTE_DEPARTURE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type Coordinate = [latitude: number, longitude: number];
export type RoutePreference = 'fastest' | 'less-walking' | 'fewer-transfers';
export type TransitMode = 'bus' | 'metro' | 'tram' | 'rail' | 'ferry' | 'funicular' | 'minibus' | 'walking';
export type GeometryQuality = 'exact' | 'approximate';

export interface TransitSnapshotPointer {
  version: string;
  manifestSha256: string;
}

export interface TransitFileMetadata {
  /** Size and digest of the compressed shard as published. */
  bytes: number;
  sha256: string;
}

interface TransitSourceMetadata {
  packageId: string;
  resourceId: string;
  resourceUrl: string;
  downloadedAt: string;
  etag?: string | null;
  lastModified?: string | null;
  bytes?: number;
  sha256?: string;
}

interface TransitManifestSource extends TransitSourceMetadata {
  provenanceVersion?: 2 | null;
  resources?: Record<string, TransitSourceMetadata>;
  tableCounts?: Record<string, number>;
}

export interface TransitServiceCalendar {
  /** Monday through Sunday, in GTFS order. */
  weekdays: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
  startDate: string | null;
  endDate: string | null;
  addedDates: string[];
  removedDates: string[];
}

export interface TransitServiceClass {
  serviceIds: string[];
  calendar: TransitServiceCalendar;
}

const pathIndexes = [
  'stops', 'stopGrid', 'routes', 'patterns', 'shapes', 'transfers', 'connectionBuckets',
] as const;

type TransitManifestIndexes = Record<(typeof pathIndexes)[number], Record<string, string>> & {
  sourceShapes: Record<string, string>;
  calendarRules: Record<string, string>;
  serviceClasses: Record<string, TransitServiceClass>;
};

export interface TransitManifest {
  schemaVersion: typeof TRANSIT_SCHEMA_VERSION;
  version: string;
  createdAt: string;
  source: TransitManifestSource;
  serviceDateRange: { start: string; end: string };
  boundingBox: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  };
  counts: Record<string, number>;
  quality: Record<string, unknown>;
  indexes: TransitManifestIndexes;
  files: Record<string, TransitFileMetadata>;
}

export interface TransitStop {
  stopId: string;
  stopCode: string | null;
  name: string;
  latitude: number;
  longitude: number;
}

export interface TransitRoute {
  routeId: string;
  shortName: string;
  longName: string;
  routeType: number;
  patternIds: string[];
}

type DirectionId = '' | '0' | '1';

export interface TransitPattern {
  patternId: string;
  routeId: string;
  directionId: DirectionId;
  stopIds: string[];
  shapeIds: string[];
  tripIds: string[];
}

export interface TransitConnection {
  /** Seconds since service-day midnight, including GTFS times above 24:00. */
  departure: number;
  arrival: number;
  tripId: string;
  routeId: string;
  serviceId: string;
  serviceClass: string;
  directionId: DirectionId;
  headsign: string;
  patternId: string;
  shapeId: string;
  fromStopId: string;
  toStopId: string;
  stopSequence: number;
  arrivalStopSequence: number;
  pickupType: 0 | 1 | 2 | 3;
  dropOffType: 0 | 1 | 2 | 3;
}

export interface TransitTransfer {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  seconds: number;
  evidence: { type: 'source' | 'cms' | 'manual'; reference: string };
}

export interface TransitGeometry {
  shapeId: string;
  sourceShapeId: string | null;
  geometryQuality: GeometryQuality;
  points: Coordinate[];
}

export interface TransitContentLink {
  title: string;
  canonicalUrl: string;
}

export interface TransitRouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  departureAt: Date;
  preference: RoutePreference;
}

export interface TransitBoardingPoint {
  role: 'origin' | 'board' | 'alight' | 'transfer' | 'destination';
  name: string;
  coordinate: Coordinate;
  stopId?: string;
  code?: string;
  contentLink?: TransitContentLink;
}

interface TransitLegDetails {
  durationMinutes: number;
  distanceMeters: number;
  departureTime: string;
  arrivalTime: string;
  geometry: Coordinate[];
  geometryQuality: GeometryQuality;
}

export type TransitLeg = TransitLegDetails & (
  | { kind: 'walk'; mode: 'walking' }
  | {
      kind: 'ride';
      mode: Exclude<TransitMode, 'walking'>;
      lineCode: string;
      color: string;
      board: TransitBoardingPoint;
      alight: TransitBoardingPoint;
      stopCount: number;
    }
);

export interface TransitItinerary {
  durationMinutes: number;
  walkingMinutes: number;
  transferCount: number;
  departureTime: string;
  arrivalTime: string;
  steps: TransitLeg[];
  keyPoints: TransitBoardingPoint[];
  metadata: {
    dataVersion: string;
    generatedAt: string;
    serviceDate: string;
    approximateWalking: boolean;
    geometryQuality: GeometryQuality;
  };
}

const versionIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const filePathPattern = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
const connectionBucketPattern = /^([a-f0-9]{64})-(?:[0-6]\d|7[01])$/;
const gridCellPattern = /^(?:0|-?[1-9]\d*)_(?:0|-?[1-9]\d*)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const instantPattern = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVersionId(value: unknown): value is string {
  return typeof value === 'string' && versionIdPattern.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && sha256Pattern.test(value);
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function isInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isServiceDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseInstant(value: unknown): number {
  if (typeof value !== 'string') return NaN;
  const match = instantPattern.exec(value);
  return match && isServiceDate(match[1]) ? Date.parse(value) : NaN;
}

function isDateRange(start: unknown, end: unknown): boolean {
  return isServiceDate(start) && isServiceDate(end) && start <= end;
}

function isBoundingBox(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const { minLatitude, maxLatitude, minLongitude, maxLongitude } = value;
  return isInRange(minLatitude, -90, 90)
    && isInRange(maxLatitude, minLatitude, 90)
    && isInRange(minLongitude, -180, 180)
    && isInRange(maxLongitude, minLongitude, 180);
}

function isCounts(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.entries(value).every(([key, count]) => key !== '' && isIntegerAtLeast(count, 0));
}

function isResourceUrl(value: unknown): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value) && URL.canParse(value);
}

function isSourceMetadata(value: unknown): value is Record<string, unknown> & TransitSourceMetadata {
  if (!isRecord(value)) return false;
  const { packageId, resourceId, resourceUrl, downloadedAt, etag, lastModified, bytes, sha256 } = value;
  return typeof packageId === 'string' && packageId.trim() !== ''
    && typeof resourceId === 'string' && resourceId.trim() !== ''
    && isResourceUrl(resourceUrl) && Number.isFinite(parseInstant(downloadedAt))
    && (etag == null || typeof etag === 'string')
    && (lastModified == null || typeof lastModified === 'string')
    && (bytes === undefined || isIntegerAtLeast(bytes, 1))
    && (sha256 === undefined || isSha256(sha256));
}

function isManifestSource(value: unknown): boolean {
  if (!isSourceMetadata(value)) return false;
  const { provenanceVersion, resources, tableCounts } = value;
  if (resources !== undefined && (!isRecord(resources) || !Object.values(resources).every(isSourceMetadata))) return false;
  if (tableCounts !== undefined && !isCounts(tableCounts)) return false;
  if (provenanceVersion == null) return true;
  if (provenanceVersion !== 2 || !isRecord(resources) || !isCounts(tableCounts)) return false;

  const requiredTables = ['stops', 'routes', 'trips', 'stop_times'];
  if (!requiredTables.every((table) => Object.hasOwn(resources, table) && tableCounts[table] >= 1)) return false;
  if (!Object.hasOwn(resources, 'calendar') && !Object.hasOwn(resources, 'calendar_dates')) return false;
  if (!Object.values(resources).every((resource) =>
    isRecord(resource) && isIntegerAtLeast(resource.bytes, 1) && isSha256(resource.sha256))) return false;

  const primary = resources.stop_times;
  return isRecord(primary)
    && ['packageId', 'resourceId', 'resourceUrl', 'downloadedAt', 'bytes', 'sha256', 'etag', 'lastModified']
      .every((field) => (value[field] ?? null) === (primary[field] ?? null));
}

function isFileInventory(value: unknown): value is Record<string, TransitFileMetadata> {
  if (!isRecord(value) || !Object.hasOwn(value, 'content-links.json.gz')) return false;
  return Object.entries(value).every(([path, file]) =>
    filePathPattern.test(path) && isRecord(file) && isIntegerAtLeast(file.bytes, 1) && isSha256(file.sha256));
}

function isServiceClass(value: unknown): value is TransitServiceClass {
  if (!isRecord(value) || !Array.isArray(value.serviceIds) || !isRecord(value.calendar)) return false;
  const { weekdays, startDate, endDate, addedDates, removedDates } = value.calendar;
  return value.serviceIds.every((id) => typeof id === 'string' && id !== '')
    && Array.isArray(weekdays) && weekdays.length === 7 && weekdays.every((day) => day === 0 || day === 1)
    && ((startDate === null && endDate === null) || isDateRange(startDate, endDate))
    && Array.isArray(addedDates) && addedDates.every(isServiceDate)
    && Array.isArray(removedDates) && removedDates.every(isServiceDate);
}

function isReferenceMap(value: unknown, target: Record<string, unknown>): boolean {
  return isRecord(value) && Object.values(value).every((reference) =>
    typeof reference === 'string' && Object.hasOwn(target, reference));
}

function hasMatchingCalendarRules(classes: Record<string, unknown>, rules: unknown): boolean {
  if (!isRecord(rules)) return false;
  const seenServiceIds = new Set<string>();
  for (const [classId, service] of Object.entries(classes)) {
    if (!isSha256(classId) || !isServiceClass(service)) return false;
    for (const serviceId of service.serviceIds) {
      if (seenServiceIds.has(serviceId) || !Object.hasOwn(rules, serviceId) || rules[serviceId] !== classId) {
        return false;
      }
      seenServiceIds.add(serviceId);
    }
  }
  return seenServiceIds.size === Object.keys(rules).length;
}

function hasMatchingConnectionBuckets(buckets: unknown, classes: Record<string, unknown>): boolean {
  return isRecord(buckets) && Object.entries(buckets).every(([bucket, path]) => {
    const match = connectionBucketPattern.exec(bucket);
    return match !== null && Object.hasOwn(classes, match[1]) && path === `connections/${bucket}.json.gz`;
  });
}

function hasMatchingSpatialIndexes(indexes: Record<string, unknown>): boolean {
  const { stopGrid, transfers, stops } = indexes;
  if (!isRecord(stopGrid) || !isRecord(transfers) || !isRecord(stops)) return false;
  const cells = Object.entries(stopGrid);
  if (cells.length !== Object.keys(transfers).length) return false;

  const stopPaths = new Set(Object.values(stopGrid));
  return Object.values(stops).every((path) => stopPaths.has(path))
    && cells.every(([cell, path]) => {
      if (!gridCellPattern.test(cell) || !Object.hasOwn(transfers, cell)) return false;
      const cellHash = createHash('sha256').update(cell).digest('hex');
      return path === `stops-grid/${cellHash}.json.gz` && transfers[cell] === `transfers/${cellHash}.json.gz`;
    });
}

function isManifestIndexes(value: unknown, files: Record<string, TransitFileMetadata>): boolean {
  if (!isRecord(value) || !isRecord(value.shapes) || !isRecord(value.serviceClasses)) return false;
  return pathIndexes.every((name) => isReferenceMap(value[name], files))
    && isReferenceMap(value.sourceShapes, value.shapes)
    && hasMatchingCalendarRules(value.serviceClasses, value.calendarRules)
    && hasMatchingConnectionBuckets(value.connectionBuckets, value.serviceClasses)
    && hasMatchingSpatialIndexes(value);
}

export function parseSnapshotPointer(value: unknown): TransitSnapshotPointer {
  if (!isRecord(value) || Object.keys(value).length !== 2
    || !Object.hasOwn(value, 'version') || !Object.hasOwn(value, 'manifestSha256')
    || !isVersionId(value.version) || !isSha256(value.manifestSha256)) {
    throw new TypeError('Invalid transit snapshot pointer');
  }
  return { version: value.version, manifestSha256: value.manifestSha256 };
}

export function parseManifest(value: unknown): TransitManifest {
  if (!isRecord(value) || value.schemaVersion !== TRANSIT_SCHEMA_VERSION) {
    throw new TypeError('Unsupported transit manifest schema version');
  }
  if (!isVersionId(value.version) || !Number.isFinite(parseInstant(value.createdAt))
    || !isManifestSource(value.source) || !isRecord(value.serviceDateRange)
    || !isDateRange(value.serviceDateRange.start, value.serviceDateRange.end)
    || !isBoundingBox(value.boundingBox) || !isCounts(value.counts) || !isRecord(value.quality)) {
    throw new TypeError('Invalid transit manifest metadata');
  }
  if (!isFileInventory(value.files) || !isManifestIndexes(value.indexes, value.files)) {
    throw new TypeError('Invalid transit manifest inventory or indexes');
  }

  return value as unknown as TransitManifest;
}

function readRouteParameter(params: URLSearchParams, name: string): string {
  const values = params.getAll(name);
  if (values.length !== 1 || values[0].length === 0 || values[0].length > 64) {
    throw new TypeError(`Invalid ${name}`);
  }
  return values[0];
}

function parseCoordinate(params: URLSearchParams, name: string, min: number, max: number): number {
  const raw = readRouteParameter(params, name);
  const value = Number(raw);
  if (!decimalPattern.test(raw) || !isInRange(value, min, max)) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

export function parseRouteRequest(url: URL, now = new Date()): TransitRouteRequest {
  const params = url.searchParams;
  const origin: Coordinate = [
    parseCoordinate(params, 'originLat', ...routeSearchBounds.latitude),
    parseCoordinate(params, 'originLng', ...routeSearchBounds.longitude),
  ];
  const destination: Coordinate = [
    parseCoordinate(params, 'destinationLat', ...routeSearchBounds.latitude),
    parseCoordinate(params, 'destinationLng', ...routeSearchBounds.longitude),
  ];
  const departure = parseInstant(readRouteParameter(params, 'departureAt'));
  if (!Number.isFinite(departure) || departure > now.getTime() + MAX_ROUTE_DEPARTURE_AHEAD_MS) {
    throw new TypeError('Invalid departureAt');
  }

  const preference = readRouteParameter(params, 'preference');
  if (preference !== 'fastest' && preference !== 'less-walking' && preference !== 'fewer-transfers') {
    throw new TypeError('Invalid preference');
  }

  return { origin, destination, departureAt: new Date(departure), preference };
}
