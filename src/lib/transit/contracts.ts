import { createHash } from 'node:crypto';
import { routeSearchBounds } from './route-search-area.ts';

export const TRANSIT_SCHEMA_VERSION = 1;
export const MAX_ROUTE_DEPARTURE_AHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type Coordinate = [latitude: number, longitude: number];
export type RoutePreference = 'fastest' | 'less-walking' | 'fewer-transfers';
export type RouteTravelMode = 'transit' | 'walking' | 'bus' | 'metro';
export type TransitMode = 'bus' | 'metro' | 'tram' | 'rail' | 'ferry' | 'funicular' | 'cable_car' | 'minibus' | 'walking';
export type TransitProvider = 'iett' | 'metro' | 'tcdd' | 'sehirhatlari' | 'minibus';
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

export type TransitProviderMode = Exclude<TransitMode, 'walking'>;

export interface TransitProviderSource {
  provider: TransitProvider;
  modes: TransitProviderMode[];
  resourceUrl: string;
  retrievedAt: string;
  bytes: number;
  sha256: string;
  status: 'current' | 'stale';
}

export interface TransitProviderSourceMap {
  providers: Record<TransitProvider, TransitProviderSource>;
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

type TransitManifestIndexesV1 = Record<(typeof pathIndexes)[number], Record<string, string>> & {
  sourceShapes: Record<string, string>;
  calendarRules: Record<string, string>;
  serviceClasses: Record<string, TransitServiceClass>;
};

type TransitManifestIndexesV2 = TransitManifestIndexesV1 & { transferGraph: string };

export interface TransitProviderCoverage {
  provider: TransitProvider;
  modes: TransitProviderMode[];
  retrievedAt: string;
  status: 'current' | 'stale';
  sourceSha256: string;
}

interface TransitManifestBase<TSource> {
  version: string;
  createdAt: string;
  source: TSource;
  serviceDateRange: { start: string; end: string };
  boundingBox: {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  };
  counts: Record<string, number>;
  quality: Record<string, unknown>;
  files: Record<string, TransitFileMetadata>;
}

export interface TransitManifestV1 extends TransitManifestBase<TransitManifestSource> {
  schemaVersion: 1;
  indexes: TransitManifestIndexesV1;
}

export interface TransitManifestV2 extends TransitManifestBase<TransitProviderSourceMap> {
  schemaVersion: 2;
  indexes: TransitManifestIndexesV2;
  providerCoverage: TransitProviderCoverage[];
}

export type TransitManifest = TransitManifestV1 | TransitManifestV2;

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
  mode?: Exclude<TransitMode, 'walking'>;
  durationSecondsEstimated?: boolean;
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
  travelMode: RouteTravelMode;
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
      estimatedDuration?: boolean;
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
const transitProviders = ['iett', 'metro', 'tcdd', 'sehirhatlari', 'minibus'] as const satisfies readonly TransitProvider[];
const providerModes = ['bus', 'metro', 'tram', 'rail', 'ferry', 'funicular', 'cable_car', 'minibus'] as const;
const providerDefinitions: Record<TransitProvider, { host: string; modes: readonly TransitProviderMode[] }> = {
  iett: { host: 'data.ibb.gov.tr', modes: ['bus'] },
  metro: { host: 'api.ibb.gov.tr', modes: ['metro', 'tram', 'funicular', 'cable_car'] },
  tcdd: { host: 'www.tcddtasimacilik.gov.tr', modes: ['rail'] },
  sehirhatlari: { host: 'sehirhatlari.istanbul', modes: ['ferry'] },
  minibus: { host: 'api.ibb.gov.tr', modes: ['minibus'] },
};

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

function isProviderSource(provider: TransitProvider, value: unknown): value is TransitProviderSource {
  if (!isRecord(value) || value.provider !== provider || !Array.isArray(value.modes) || value.modes.length === 0
    || new Set(value.modes).size !== value.modes.length || !isIntegerAtLeast(value.bytes, 1)
    || !isSha256(value.sha256) || !Number.isFinite(parseInstant(value.retrievedAt))
    || (value.status !== 'current' && value.status !== 'stale')) return false;
  const definition = providerDefinitions[provider];
  if (!value.modes.every((mode) => definition.modes.includes(mode as TransitProviderMode))) return false;
  try {
    const url = new URL(typeof value.resourceUrl === 'string' ? value.resourceUrl : '');
    return url.protocol === 'https:' && url.hostname.toLowerCase() === definition.host
      && (url.port === '' || url.port === '443') && url.username === '' && url.password === '' && url.hash === '';
  } catch {
    return false;
  }
}

function isProviderSourceMap(value: unknown): value is TransitProviderSourceMap {
  if (!isRecord(value) || !isRecord(value.providers)
    || Object.keys(value.providers).length !== transitProviders.length) return false;
  const providers = value.providers;
  return transitProviders.every((provider) => isProviderSource(provider, providers[provider]));
}

function isFileInventory(value: unknown): value is Record<string, TransitFileMetadata> {
  if (!isRecord(value) || !Object.hasOwn(value, 'content-links.json.gz')) return false;
  return Object.entries(value).every(([path, file]) =>
    filePathPattern.test(path) && isRecord(file) && isIntegerAtLeast(file.bytes, 1) && isSha256(file.sha256));
}

function isProviderCoverage(value: unknown, source: TransitProviderSourceMap): value is TransitProviderCoverage[] {
  if (!Array.isArray(value) || value.length !== transitProviders.length) return false;
  const seen = new Set<TransitProvider>();
  for (const entry of value) {
    if (!isRecord(entry) || Object.keys(entry).length !== 5
      || !transitProviders.includes(entry.provider as TransitProvider)
      || !Array.isArray(entry.modes) || entry.modes.length === 0
      || !entry.modes.every((mode) => providerModes.includes(mode as (typeof providerModes)[number]))
      || new Set(entry.modes).size !== entry.modes.length
      || !Number.isFinite(parseInstant(entry.retrievedAt))
      || (entry.status !== 'current' && entry.status !== 'stale')
      || !isSha256(entry.sourceSha256)) return false;
    const provider = entry.provider as TransitProvider;
    const artifact = source.providers[provider];
    if (seen.has(provider) || entry.modes.length !== artifact.modes.length
      || !entry.modes.every((mode, index) => mode === artifact.modes[index])
      || entry.retrievedAt !== artifact.retrievedAt || entry.status !== artifact.status
      || entry.sourceSha256 !== artifact.sha256) return false;
    seen.add(provider);
  }
  return transitProviders.every((provider) => seen.has(provider));
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

function isManifestIndexes(value: unknown, files: Record<string, TransitFileMetadata>, schemaVersion: 1 | 2): boolean {
  if (!isRecord(value) || !isRecord(value.shapes) || !isRecord(value.serviceClasses)) return false;
  const transferGraphValid = schemaVersion === 1 || (value.transferGraph === 'transfers/graph.json.gz'
    && Object.hasOwn(files, value.transferGraph));
  return transferGraphValid && pathIndexes.every((name) => isReferenceMap(value[name], files))
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
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) {
    throw new TypeError('Unsupported transit manifest schema version');
  }
  const sourceIsValid = value.schemaVersion === 1
    ? isManifestSource(value.source)
    : isProviderSourceMap(value.source);
  if (!isVersionId(value.version) || !Number.isFinite(parseInstant(value.createdAt))
    || !sourceIsValid || !isRecord(value.serviceDateRange)
    || !isDateRange(value.serviceDateRange.start, value.serviceDateRange.end)
    || !isBoundingBox(value.boundingBox) || !isCounts(value.counts) || !isRecord(value.quality)) {
    throw new TypeError('Invalid transit manifest metadata');
  }
  if (!isFileInventory(value.files) || !isManifestIndexes(value.indexes, value.files, value.schemaVersion)
    || (value.schemaVersion === 2
      && (!isProviderSourceMap(value.source) || !isProviderCoverage(value.providerCoverage, value.source)))) {
    throw new TypeError('Invalid transit manifest inventory or indexes');
  }

  return value as unknown as TransitManifest;
}

const routeRequestFields = [
  'originLat', 'originLng', 'destinationLat', 'destinationLng', 'departureAt', 'preference', 'travelMode',
] as const;

function readRouteString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

function parseCoordinate(body: Record<string, unknown>, name: string, min: number, max: number): number {
  const value = body[name];
  if (!isInRange(value, min, max)) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value;
}

export function parseRouteRequest(value: unknown, now = new Date()): TransitRouteRequest {
  if (!isRecord(value) || Object.keys(value).length !== routeRequestFields.length
    || routeRequestFields.some((field) => !Object.hasOwn(value, field))) {
    throw new TypeError('Invalid route request body');
  }
  const origin: Coordinate = [
    parseCoordinate(value, 'originLat', ...routeSearchBounds.latitude),
    parseCoordinate(value, 'originLng', ...routeSearchBounds.longitude),
  ];
  const destination: Coordinate = [
    parseCoordinate(value, 'destinationLat', ...routeSearchBounds.latitude),
    parseCoordinate(value, 'destinationLng', ...routeSearchBounds.longitude),
  ];
  const departure = parseInstant(readRouteString(value, 'departureAt'));
  if (!Number.isFinite(departure) || departure > now.getTime() + MAX_ROUTE_DEPARTURE_AHEAD_MS) {
    throw new TypeError('Invalid departureAt');
  }

  const preference = readRouteString(value, 'preference');
  if (preference !== 'fastest' && preference !== 'less-walking' && preference !== 'fewer-transfers') {
    throw new TypeError('Invalid preference');
  }

  const travelMode = readRouteString(value, 'travelMode');
  if (travelMode !== 'transit' && travelMode !== 'walking' && travelMode !== 'bus' && travelMode !== 'metro') {
    throw new TypeError('Invalid travelMode');
  }

  return { origin, destination, departureAt: new Date(departure), preference, travelMode };
}
