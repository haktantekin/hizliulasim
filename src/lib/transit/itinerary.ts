import { createHash } from 'node:crypto';
import { BROKEN_DURAK_SLUGS } from '../../broken-redirects.ts';
import {
  TRANSIT_SCHEMA_VERSION, type Coordinate, type TransitBoardingPoint, type TransitContentLink, type TransitGeometry,
  type TransitItinerary, type TransitLeg, type TransitManifest, type TransitMode, type TransitPattern,
  type TransitRoute, type TransitStop,
} from './contracts.ts';
import type { JourneySegment } from './router.ts';
import { loadSnapshotShard, TransitSnapshotError, type LoadedSnapshot } from './snapshot-source.ts';
import { getStopGridCell } from './spatial.ts';

type Ride = Extract<JourneySegment, { kind: 'ride' }>;
type Walk = Extract<JourneySegment, { kind: 'walk' }>;
type RideMode = Exclude<TransitMode, 'walking'>;
type PathIndex = Readonly<Record<string, string>>;
const indexedAssetKinds = ['stops', 'routes', 'patterns', 'shapes'] as const;
type IndexedAssetKind = (typeof indexedAssetKinds)[number];

const contentLinksPath = 'content-links.json.gz';
// Match the canonical stop route emitted by the CMS, including its numeric slug suffix.
const stopUrl = /^https:\/\/hizliulasim\.com\/otobus-duraklari\/([a-z0-9]+(?:-[a-z0-9]+)*-[0-9]+)$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const radians = Math.PI / 180;
const earthRadiusMeters = 6_371_000;
const maxShapeStopOffsetMeters = 30;
const maxExactShapePoints = 16_384;
const maxExactProjectionChecksPerItinerary = 1_000_000;
const istanbulClock = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// Standard GTFS route types and unambiguous extended types used by these modes.
const rideModes: Readonly<Partial<Record<number, RideMode>>> = {
  0: 'tram', 1: 'metro', 2: 'rail', 3: 'bus', 4: 'ferry', 5: 'tram', 7: 'funicular', 11: 'bus', 12: 'rail',
  100: 'rail', 109: 'rail', 401: 'metro', 402: 'metro', 700: 'bus', 800: 'bus', 900: 'tram',
  1200: 'ferry', 1400: 'funicular', 1501: 'minibus',
};
const rideColors: Record<RideMode, string> = {
  bus: '#f59e0b', metro: '#dc2626', rail: '#881337', tram: '#e11d48',
  ferry: '#2563eb', funicular: '#be123c', minibus: '#7c3aed',
};

export interface ShapeIndex {
  stops: ReadonlyMap<string, TransitStop>;
  shapes: ReadonlyMap<string, TransitGeometry>;
}

export type ContentLinkIndex = Readonly<Partial<Record<string, TransitContentLink>>>;

interface ItineraryOptions {
  originName?: string;
  destinationName?: string;
  now?: () => Date;
}

function invalidShard(): never {
  throw new TransitSnapshotError('INVALID_SHARD');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2
    && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90
    && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isId);
}

function isUniqueIdList(value: unknown): value is string[] {
  return isIdList(value) && new Set(value).size === value.length;
}

function hasPath(index: PathIndex, id: string, path: string): boolean {
  return Object.hasOwn(index, id) && index[id] === path;
}

function getRequired<T>(index: ReadonlyMap<string, T>, id: string): T {
  return index.get(id) ?? invalidShard();
}

function isStop(value: unknown): value is TransitStop {
  return isRecord(value) && isId(value.stopId) && typeof value.name === 'string'
    && (value.stopCode === null || typeof value.stopCode === 'string')
    && isCoordinate([value.latitude, value.longitude]);
}

function isRoute(value: unknown): value is TransitRoute {
  return isRecord(value) && isId(value.routeId) && typeof value.shortName === 'string'
    && typeof value.longName === 'string' && typeof value.routeType === 'number'
    && Number.isInteger(value.routeType) && isUniqueIdList(value.patternIds);
}

function isPattern(value: unknown): value is TransitPattern {
  return isRecord(value) && isId(value.patternId) && isId(value.routeId)
    && (value.directionId === '0' || value.directionId === '1' || value.directionId === '')
    && isIdList(value.stopIds) && value.stopIds.length >= 2
    && isUniqueIdList(value.shapeIds) && value.shapeIds.length > 0
    && isUniqueIdList(value.tripIds) && value.tripIds.length > 0;
}

function isShape(value: unknown): value is TransitGeometry {
  return isRecord(value) && isId(value.shapeId)
    && ((value.geometryQuality === 'exact' && isId(value.sourceShapeId))
      || (value.geometryQuality === 'approximate' && value.sourceShapeId === null))
    && Array.isArray(value.points) && value.points.length >= 2 && value.points.every(isCoordinate);
}

function isContentLink(value: unknown): value is TransitContentLink {
  if (!isRecord(value) || Object.keys(value).length !== 2 || typeof value.title !== 'string'
    || typeof value.canonicalUrl !== 'string' || value.canonicalUrl.trim() !== value.canonicalUrl) return false;
  const match = stopUrl.exec(value.canonicalUrl);
  return match !== null && !BROKEN_DURAK_SLUGS.has(match[1]);
}

export function attachContentLink(stopId: string, links: ContentLinkIndex): TransitContentLink | undefined {
  if (!Object.hasOwn(links, stopId)) return undefined;
  const link = links[stopId];
  if (!isContentLink(link)) return invalidShard();
  return link;
}

function readContentLinks(payload: unknown, stops: PathIndex): ContentLinkIndex {
  if (!isRecord(payload) || payload.schemaVersion !== TRANSIT_SCHEMA_VERSION || !isRecord(payload.links)) {
    return invalidShard();
  }
  for (const [id, link] of Object.entries(payload.links)) {
    if (!Object.hasOwn(stops, id) || !isContentLink(link)) return invalidShard();
  }
  return payload.links as ContentLinkIndex;
}

function stopCoordinate(stop: TransitStop): Coordinate {
  return [stop.latitude, stop.longitude];
}

function fromStopId(segment: JourneySegment): string | undefined {
  return segment.kind === 'walk' && segment.role === 'access' ? undefined : segment.fromStopId;
}

function toStopId(segment: JourneySegment): string | undefined {
  return segment.kind === 'walk' && segment.role === 'egress' ? undefined : segment.toStopId;
}

function readCollection<T>(values: unknown, guard: (value: unknown) => value is T, idOf: (value: T) => string,
  index: PathIndex, path: string): Map<string, T> {
  if (!Array.isArray(values) || values.length === 0) return invalidShard();
  const records = new Map<string, T>();
  for (const value of values) {
    if (!guard(value)) return invalidShard();
    const id = idOf(value);
    if (records.has(id) || !hasPath(index, id, path)) return invalidShard();
    records.set(id, value);
  }
  return records;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function expectedRecordCounts(indexes: TransitManifest['indexes'], requests: Record<IndexedAssetKind, Iterable<string>>) {
  const paths = new Map<string, { kind: IndexedAssetKind | 'links'; count: number }>([
    [contentLinksPath, { kind: 'links', count: 0 }],
  ]);
  for (const kind of indexedAssetKinds) {
    for (const id of requests[kind]) {
      if (!Object.hasOwn(indexes[kind], id)) return invalidShard();
      const path = indexes[kind][id];
      const known = paths.get(path);
      if (known && known.kind !== kind) return invalidShard();
      if (!known) paths.set(path, { kind, count: 0 });
    }
  }

  // Include indexed peers and kind aliases even if their IDs are outside the journey.
  for (const kind of indexedAssetKinds) {
    for (const [id, path] of Object.entries(indexes[kind])) {
      const asset = paths.get(path);
      if (!asset) continue;
      if (asset.kind !== kind) return invalidShard();
      if (kind !== 'stops') {
        const digest = kind === 'routes' ? sha256(id) : id;
        if (!sha256Pattern.test(digest) || path !== `${kind}/${digest}.json.gz`) return invalidShard();
      }
      asset.count++;
    }
  }
  return paths;
}

async function loadIndexed<T>(ids: Iterable<string>, index: PathIndex, expected: ReturnType<typeof expectedRecordCounts>,
  readRecords: (path: string) => Promise<Map<string, T>>): Promise<Map<string, T>> {
  const byPath = new Map<string, Promise<Map<string, T>>>();
  const entries = await Promise.all([...new Set(ids)].map(async (id): Promise<[string, T]> => {
    const path = index[id];
    let records = byPath.get(path);
    if (!records) {
      records = readRecords(path).then((loaded) => {
        if (loaded.size !== getRequired(expected, path).count) return invalidShard();
        return loaded;
      });
      byPath.set(path, records);
    }
    return [id, getRequired(await records, id)];
  }));
  return new Map(entries);
}

async function loadJourneyAssets(journey: JourneySegment[], rides: Ride[], snapshot: LoadedSnapshot) {
  const indexes = snapshot.manifest.indexes;
  const stopIds = new Set<string>();
  for (const segment of journey) {
    if (segment.kind === 'ride') segment.stopIds.forEach((id) => stopIds.add(id));
    else {
      const from = fromStopId(segment);
      const to = toStopId(segment);
      if (from !== undefined) stopIds.add(from);
      if (to !== undefined) stopIds.add(to);
    }
  }

  const requests = { stops: stopIds, routes: rides.map(({ routeId }) => routeId),
    patterns: rides.map(({ patternId }) => patternId), shapes: rides.map(({ shapeId }) => shapeId) };
  const expected = expectedRecordCounts(indexes, requests);
  const read = (path: string) => loadSnapshotShard<unknown>(snapshot, path);

  const cells = new Map(Object.entries(indexes.stopGrid).map(([cell, path]) => [path, cell]));
  const [stops, routes, patterns, shapes, links] = await Promise.all([
    loadIndexed(requests.stops, indexes.stops, expected, async (path) => {
      const cell = cells.get(path);
      if (!cell || path !== `stops-grid/${sha256(cell)}.json.gz`) return invalidShard();
      const shard = await read(path);
      if (!isRecord(shard) || shard.cell !== cell || shard.precision !== 0.01) return invalidShard();
      const records = readCollection(shard.stops, isStop, (stop) => stop.stopId, indexes.stops, path);
      for (const stop of records.values()) {
        if (getStopGridCell(stopCoordinate(stop)) !== cell) return invalidShard();
      }
      return records;
    }),
    loadIndexed(requests.routes, indexes.routes, expected, async (path) => {
      const route = await read(path);
      if (!isRoute(route) || !hasPath(indexes.routes, route.routeId, path)
        || !route.patternIds.every((id) => Object.hasOwn(indexes.patterns, id))
        || !Object.hasOwn(rideModes, route.routeType)) return invalidShard();
      return new Map([[route.routeId, route]]);
    }),
    loadIndexed(requests.patterns, indexes.patterns, expected, async (path) => {
      const shard = await read(path);
      const records = readCollection(isRecord(shard) ? shard.patterns : undefined,
        isPattern, (pattern) => pattern.patternId, indexes.patterns, path);
      for (const pattern of records.values()) {
        if (!Object.hasOwn(indexes.routes, pattern.routeId)
          || !pattern.stopIds.every((id) => Object.hasOwn(indexes.stops, id))
          || !pattern.shapeIds.every((id) => Object.hasOwn(indexes.shapes, id))) return invalidShard();
      }
      return records;
    }),
    loadIndexed(requests.shapes, indexes.shapes, expected, async (path) => {
      const shard = await read(path);
      const records = readCollection(isRecord(shard) ? shard.shapes : undefined,
        isShape, (shape) => shape.shapeId, indexes.shapes, path);
      for (const shape of records.values()) {
        if (shape.sourceShapeId !== null && !hasPath(indexes.sourceShapes, shape.sourceShapeId, shape.shapeId)) {
          return invalidShard();
        }
      }
      return records;
    }),
    read(contentLinksPath).then((payload) => readContentLinks(payload, indexes.stops)),
  ]);
  for (const [sourceId, shapeId] of Object.entries(indexes.sourceShapes)) {
    const shape = shapes.get(shapeId);
    if (shape && shape.sourceShapeId !== sourceId) return invalidShard();
  }
  return { stops, routes, patterns, shapes, links };
}

function validateJourney(journey: JourneySegment[]) {
  const start = journey[0];
  const end = journey.at(-1);
  if (start?.kind !== 'walk' || start.role !== 'access' || !isCoordinate(start.fromCoordinate)
    || end?.kind !== 'walk' || end.role !== 'egress' || !isCoordinate(end.toCoordinate)) return invalidShard();

  for (const [index, segment] of journey.entries()) {
    if (!Number.isFinite(segment.departureEpochMs) || !Number.isFinite(segment.arrivalEpochMs)
      || segment.arrivalEpochMs < segment.departureEpochMs) return invalidShard();
    if (index > 0) {
      const previous = journey[index - 1];
      if (fromStopId(segment) === undefined || fromStopId(segment) !== toStopId(previous)
        || segment.departureEpochMs < previous.arrivalEpochMs) return invalidShard();
    }
    if (segment.kind === 'walk') {
      if (!Number.isFinite(segment.distanceMeters) || segment.distanceMeters < 0
        || !Number.isFinite(segment.walkingSeconds) || segment.walkingSeconds < 0
        || segment.walkingSeconds * 1000 > segment.arrivalEpochMs - segment.departureEpochMs) return invalidShard();
    } else {
      if (!isIdList(segment.stopIds) || segment.stopIds[0] !== segment.fromStopId
        || segment.stopIds.at(-1) !== segment.toStopId || !Number.isSafeInteger(segment.stopSequence)
        || !Number.isSafeInteger(segment.arrivalStopSequence) || segment.stopSequence < 0
        || segment.arrivalStopSequence <= segment.stopSequence) return invalidShard();
    }
  }
  return { start, end };
}

function isPatternSection(rideStops: string[], patternStops: string[]): boolean {
  // The router collapses consecutive dwell entries and GTFS sequences may have gaps.
  const ordered = patternStops.filter((id, index) => index === 0 || patternStops[index - 1] !== id);
  return ordered.some((id, start) => id === rideStops[0] && rideStops.every((stop, offset) => ordered[start + offset] === stop));
}

function validateRides(rides: Ride[], assets: Awaited<ReturnType<typeof loadJourneyAssets>>, manifest: TransitManifest): void {
  const { start, end } = manifest.serviceDateRange;
  for (const ride of rides) {
    const route = getRequired(assets.routes, ride.routeId);
    const pattern = getRequired(assets.patterns, ride.patternId);
    if (!route.patternIds.includes(ride.patternId) || pattern.routeId !== ride.routeId
      || pattern.directionId !== ride.directionId || !pattern.tripIds.includes(ride.tripId)
      || !pattern.shapeIds.includes(ride.shapeId) || !isPatternSection(ride.stopIds, pattern.stopIds)
      || !Object.hasOwn(manifest.indexes.calendarRules, ride.serviceId)
      || !/^\d{4}-\d{2}-\d{2}$/.test(ride.serviceDate) || ride.serviceDate < start || ride.serviceDate > end) {
      return invalidShard();
    }
  }
}

function coalesceRides(journey: JourneySegment[]): JourneySegment[] {
  const legs: JourneySegment[] = [];
  for (const segment of journey) {
    const previous = legs.at(-1);
    if (previous?.kind === 'ride' && segment.kind === 'ride'
      && previous.serviceDate === segment.serviceDate && previous.tripId === segment.tripId
      && previous.serviceId === segment.serviceId && previous.routeId === segment.routeId
      && previous.patternId === segment.patternId && previous.shapeId === segment.shapeId
      && previous.directionId === segment.directionId && previous.headsign === segment.headsign
      && previous.toStopId === segment.fromStopId && previous.arrivalStopSequence === segment.stopSequence) {
      previous.stopIds.push(...segment.stopIds.slice(1));
      previous.toStopId = segment.toStopId;
      previous.arrivalStopSequence = segment.arrivalStopSequence;
      previous.arrivalEpochMs = segment.arrivalEpochMs;
    } else {
      legs.push(segment.kind === 'ride' ? { ...segment, stopIds: [...segment.stopIds] } : segment);
    }
  }
  return legs;
}

function sameCoordinate(first: Coordinate, second: Coordinate): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function distanceMeters(from: Coordinate, to: Coordinate): number {
  const value = Math.sin((to[0] - from[0]) * radians / 2) ** 2
    + Math.cos(from[0] * radians) * Math.cos(to[0] * radians) * Math.sin((to[1] - from[1]) * radians / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, value)));
}

function projectOntoShape(stop: Coordinate, points: Coordinate[]): number | undefined {
  const metersPerDegree = earthRadiusMeters * radians;
  const longitudeScale = metersPerDegree * Math.cos(stop[0] * radians);
  const toleranceSquared = maxShapeStopOffsetMeters ** 2;
  let nearest: { position: number; distanceSquared: number } | undefined;
  let previousNearbyEdge = -1;
  let tied = false;

  for (let edge = 0; edge < points.length - 1; edge++) {
    const [fromLat, fromLng] = points[edge];
    const [toLat, toLng] = points[edge + 1];
    const x = (fromLng - stop[1]) * longitudeScale;
    const y = (fromLat - stop[0]) * metersPerDegree;
    const dx = (toLng - fromLng) * longitudeScale;
    const dy = (toLat - fromLat) * metersPerDegree;
    const along = Math.max(0, Math.min(1, -(x * dx + y * dy) / (dx * dx + dy * dy)));
    const distanceSquared = (x + along * dx) ** 2 + (y + along * dy) ** 2;
    if (distanceSquared > toleranceSquared) continue;

    // A second pass through the stop radius makes the relevant traversal ambiguous.
    if (nearest && (edge !== previousNearbyEdge + 1 || x * x + y * y > toleranceSquared)) return undefined;
    previousNearbyEdge = edge;
    const position = edge + along;
    if (!nearest || distanceSquared < nearest.distanceSquared - 1e-6) {
      nearest = { position, distanceSquared };
      tied = false;
    } else if (Math.abs(distanceSquared - nearest.distanceSquared) <= 1e-6
      && Math.abs(position - nearest.position) > 1e-6) {
      tied = true;
    }
  }
  return tied ? undefined : nearest?.position;
}

function trimShape(points: Coordinate[], stops: Coordinate[]): Coordinate[] | undefined {
  const distinct = points.filter((point, index) => index === 0 || !sameCoordinate(point, points[index - 1]));
  let start: number | undefined;
  let end = -1;
  for (const stop of stops) {
    const position = projectOntoShape(stop, distinct);
    if (position === undefined || position <= end) return undefined;
    start ??= position;
    end = position;
  }
  if (start === undefined || end <= start) return undefined;
  const from = stops[0];
  const to = stops[stops.length - 1];
  const clipped = [pointAlongShape(distinct, start),
    ...distinct.slice(Math.floor(start) + 1, Math.ceil(end)), pointAlongShape(distinct, end)];
  // An entire loop can fit inside one stop's projection radius.
  const seen = new Set<string>();
  for (const [latitude, longitude] of clipped) {
    const key = `${latitude},${longitude}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
  }
  // Published stop coordinates may sit a few metres from the verified track or road.
  if (distanceMeters(from, clipped[0]) < 0.001) clipped[0] = from;
  else clipped.unshift(from);
  if (distanceMeters(to, clipped[clipped.length - 1]) < 0.001) clipped[clipped.length - 1] = to;
  else clipped.push(to);
  return clipped;
}

function pointAlongShape(points: Coordinate[], position: number): Coordinate {
  const edge = Math.floor(position);
  const along = position - edge;
  const [latitude, longitude] = points[edge];
  if (along === 0) return points[edge];
  const [nextLatitude, nextLongitude] = points[edge + 1];
  return [latitude + (nextLatitude - latitude) * along, longitude + (nextLongitude - longitude) * along];
}

function walkPoints(segment: Walk, stops: ShapeIndex['stops']): Coordinate[] {
  const from = segment.role === 'access' ? segment.fromCoordinate : stopCoordinate(getRequired(stops, segment.fromStopId));
  const to = segment.role === 'egress' ? segment.toCoordinate : stopCoordinate(getRequired(stops, segment.toStopId));
  return [from, to];
}

/** Return one geometry per segment, in the same order as the segments. */
export function mergeLegGeometry(segments: JourneySegment[], { stops, shapes }: ShapeIndex): TransitGeometry[] {
  let remainingProjectionChecks = maxExactProjectionChecksPerItinerary;
  return segments.map((segment) => {
    if (segment.kind === 'walk') {
      return { shapeId: '', sourceShapeId: null, geometryQuality: 'approximate', points: walkPoints(segment, stops) };
    }
    const relevantStops = segment.stopIds.map((id) => stopCoordinate(getRequired(stops, id)));
    const shape = shapes.get(segment.shapeId);
    if (shape?.geometryQuality === 'exact' && shape.points.length <= maxExactShapePoints) {
      const projectionChecks = (shape.points.length - 1) * relevantStops.length;
      if (projectionChecks <= remainingProjectionChecks) {
        remainingProjectionChecks -= projectionChecks;
        const points = trimShape(shape.points, relevantStops);
        if (points) return { ...shape, points };
      }
    }
    return { shapeId: segment.shapeId, sourceShapeId: null, geometryQuality: 'approximate', points: relevantStops };
  });
}

function boardingPoint(role: 'board' | 'alight' | 'transfer', stop: TransitStop, links: ContentLinkIndex): TransitBoardingPoint {
  const contentLink = attachContentLink(stop.stopId, links);
  return { role, stopId: stop.stopId, name: stop.name, coordinate: stopCoordinate(stop),
    ...(stop.stopCode === null ? {} : { code: stop.stopCode }), ...(contentLink ? { contentLink } : {}) };
}

/** Keep origin, destination and walk-only transfer endpoints from the itinerary's named points. */
export function collectKeyPoints(itinerary: TransitItinerary): TransitBoardingPoint[] {
  const points: TransitBoardingPoint[] = [];
  const origin = itinerary.keyPoints.find(({ role }) => role === 'origin');
  const destination = itinerary.keyPoints.find(({ role }) => role === 'destination');
  const transfers = itinerary.keyPoints.filter(({ role }) => role === 'transfer');
  if (origin) points.push(origin);
  for (const [index, step] of itinerary.steps.entries()) {
    const previous = itinerary.steps[index - 1];
    const next = itinerary.steps[index + 1];
    if (step.kind === 'ride') {
      if (previous?.kind !== 'ride' || previous.alight.stopId === undefined || previous.alight.stopId !== step.board.stopId) {
        points.push(step.board);
      }
      const changeHere = next?.kind === 'ride' && step.alight.stopId !== undefined && step.alight.stopId === next.board.stopId;
      points.push(changeHere ? { ...step.alight, role: 'transfer' } : step.alight);
    } else if (index > 0 && next?.kind === 'walk') {
      const end = step.geometry.at(-1);
      const transferIndex = end ? transfers.findIndex((point) => sameCoordinate(point.coordinate, end)) : -1;
      if (transferIndex >= 0) points.push(...transfers.splice(transferIndex, 1));
    }
  }
  if (destination) points.push(destination);
  return points;
}

function stepDistance(points: Coordinate[]): number {
  return Math.round(points.slice(1).reduce((sum, to, index) => sum + distanceMeters(points[index], to), 0));
}

export async function buildItinerary(journey: JourneySegment[], snapshot: LoadedSnapshot,
  options: ItineraryOptions = {}): Promise<TransitItinerary> {
  const { start, end } = validateJourney(journey);
  const legs = coalesceRides(journey);
  const rides = legs.filter((leg) => leg.kind === 'ride');
  if (rides.length === 0) return invalidShard();
  const assets = await loadJourneyAssets(legs, rides, snapshot);
  validateRides(rides, assets, snapshot.manifest);
  const geometries = mergeLegGeometry(legs, assets);
  const keyPoints: TransitBoardingPoint[] = [
    { role: 'origin', name: options.originName ?? 'Başlangıç', coordinate: start.fromCoordinate },
    { role: 'destination', name: options.destinationName ?? 'Hedef', coordinate: end.toCoordinate },
  ];
  let walkingSeconds = 0;
  let rideLegs = 0;
  const steps = legs.map((leg, index): TransitLeg => {
    const { points: geometry, geometryQuality } = geometries[index];
    const times = { departureTime: istanbulClock.format(leg.departureEpochMs), arrivalTime: istanbulClock.format(leg.arrivalEpochMs),
      durationMinutes: Math.ceil((leg.arrivalEpochMs - leg.departureEpochMs) / 60_000) };
    if (leg.kind === 'walk') {
      walkingSeconds += leg.walkingSeconds;
      if (leg.role === 'transfer' && legs[index + 1]?.kind !== 'ride') {
        keyPoints.push(boardingPoint('transfer', getRequired(assets.stops, leg.toStopId), assets.links));
      }
      return { kind: 'walk', mode: 'walking', distanceMeters: leg.distanceMeters, geometry, geometryQuality, ...times };
    }

    if (leg.fromStopId === leg.toStopId || leg.arrivalEpochMs <= leg.departureEpochMs) return invalidShard();
    rideLegs++;
    const route = getRequired(assets.routes, leg.routeId);
    const mode = rideModes[route.routeType] ?? invalidShard();
    return {
      kind: 'ride', mode, color: rideColors[mode], lineCode: route.shortName || route.longName || route.routeId,
      board: boardingPoint('board', getRequired(assets.stops, leg.fromStopId), assets.links),
      alight: boardingPoint('alight', getRequired(assets.stops, leg.toStopId), assets.links),
      stopCount: leg.stopIds.length - 1,
      distanceMeters: stepDistance(geometry), geometry, geometryQuality, ...times,
    };
  });

  const itinerary: TransitItinerary = {
    steps, keyPoints, durationMinutes: Math.ceil((end.arrivalEpochMs - start.departureEpochMs) / 60_000),
    walkingMinutes: Math.ceil(walkingSeconds / 60), transferCount: Math.max(0, rideLegs - 1),
    departureTime: steps[0].departureTime, arrivalTime: steps[steps.length - 1].arrivalTime,
    metadata: { dataVersion: snapshot.version, generatedAt: (options.now ?? (() => new Date()))().toISOString(),
      serviceDate: rides[0].serviceDate, approximateWalking: steps.some(({ kind }) => kind === 'walk'),
      geometryQuality: steps.some((step) => step.geometryQuality === 'approximate') ? 'approximate' : 'exact' },
  };
  itinerary.keyPoints = collectKeyPoints(itinerary);
  return itinerary;
}
