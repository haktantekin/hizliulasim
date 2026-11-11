import type { Coordinate, TransitStop, TransitTransfer } from './contracts.ts';
import { loadSnapshotShard, TransitSnapshotError, type LoadedSnapshot } from './snapshot-source.ts';

const gridCellsPerDegree = 100;
const gridRoundingScale = 1e9;
const earthRadiusMeters = 6_371_000;
const maxNearbyRadiusMeters = 350;
const maxNearbyCandidates = 8;
const walkingMetersPerSecond = 1.1;
const boardingBufferSeconds = 30;
const transferBufferSeconds = 60;
const maxTransferDistanceMeters = 350;
const maxTransferNeighbors = 8;
const maxTransferSeconds = 3600;
const maxEvidenceReferenceBytes = 512;

export type StopGrid = Readonly<Partial<Record<string, readonly TransitStop[]>>>;

export interface NearbyStopOptions {
  radiusMeters?: number;
  maxCandidates?: number;
}

export interface NearbyStop {
  stop: TransitStop;
  distanceMeters: number;
}

export interface WalkEstimate {
  distanceMeters: number;
  walkingSeconds: number;
  boardingBufferSeconds: number;
  transferBufferSeconds: number;
  approximate: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCoordinate(point: unknown): point is Coordinate {
  return Array.isArray(point) && point.length === 2
    && Number.isFinite(point[0]) && Math.abs(point[0]) <= 90
    && Number.isFinite(point[1]) && Math.abs(point[1]) <= 180;
}

function gridCellNumber(coordinate: number): number {
  const scaled = coordinate * gridCellsPerDegree;
  // PHP round() uses half-away-from-zero rounding at the requested precision.
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled) * gridRoundingScale) / gridRoundingScale;
  return Math.floor(rounded);
}

export function getStopGridCell(point: Coordinate): string | null {
  return isCoordinate(point) ? `${gridCellNumber(point[0])}_${gridCellNumber(point[1])}` : null;
}

function neighboringGridCells(latitude: number, longitude: number): string[] {
  const cells: string[] = [];
  for (let latOffset = -1; latOffset <= 1; latOffset++) {
    for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
      cells.push(`${latitude + latOffset}_${longitude + lngOffset}`);
    }
  }
  return cells;
}

export function getNearbyStopGridCells(point: Coordinate): string[] {
  return isCoordinate(point) ? neighboringGridCells(gridCellNumber(point[0]), gridCellNumber(point[1])) : [];
}

function haversineDistanceMeters(from: Coordinate, to: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to[0] - from[0]) * radians;
  const longitudeDelta = (to[1] - from[1]) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from[0] * radians) * Math.cos(to[0] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, a)));
}

function compareIds(first: string, second: string): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

function isTransitStop(stop: unknown): stop is TransitStop {
  return isRecord(stop)
    && typeof stop.stopId === 'string' && stop.stopId.trim() !== ''
    && typeof stop.name === 'string'
    && (stop.stopCode === null || typeof stop.stopCode === 'string')
    && isCoordinate([stop.latitude, stop.longitude]);
}

export function findNearbyStops(point: Coordinate, grid: StopGrid, options: NearbyStopOptions): NearbyStop[] {
  const { radiusMeters = maxNearbyRadiusMeters, maxCandidates = maxNearbyCandidates } = options;
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0
    || !Number.isSafeInteger(maxCandidates) || maxCandidates <= 0) return [];

  const radius = Math.min(radiusMeters, maxNearbyRadiusMeters);
  const closestById = new Map<string, NearbyStop>();
  for (const cell of getNearbyStopGridCells(point)) {
    const stops = grid[cell];
    if (!Array.isArray(stops)) continue;
    for (const stop of stops) {
      if (!isTransitStop(stop)) continue;
      const coordinate: Coordinate = [stop.latitude, stop.longitude];
      if (getStopGridCell(coordinate) !== cell) continue;
      const distanceMeters = haversineDistanceMeters(point, coordinate);
      if (distanceMeters > radius) continue;
      const previous = closestById.get(stop.stopId);
      if (!previous || distanceMeters < previous.distanceMeters) {
        closestById.set(stop.stopId, { stop, distanceMeters });
      }
    }
  }

  return [...closestById.values()]
    .sort((first, second) => first.distanceMeters - second.distanceMeters || compareIds(first.stop.stopId, second.stop.stopId))
    .slice(0, Math.min(maxCandidates, maxNearbyCandidates));
}

export function estimateWalk(distanceMeters: number, speed = walkingMetersPerSecond): WalkEstimate {
  const walkingSeconds = Math.ceil(distanceMeters / speed);
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0 || !Number.isFinite(speed) || speed <= 0
    || speed > walkingMetersPerSecond || !Number.isSafeInteger(walkingSeconds)) {
    throw new RangeError('Invalid transit walking estimate');
  }
  return { distanceMeters, walkingSeconds, boardingBufferSeconds, transferBufferSeconds, approximate: true };
}

function isTransfer(value: unknown, stopPath: string, stops: Record<string, string>): value is TransitTransfer {
  if (!isRecord(value)) return false;
  const { fromStopId, toStopId, distanceMeters, seconds, evidence } = value;
  return typeof fromStopId === 'string' && Object.hasOwn(stops, fromStopId) && stops[fromStopId] === stopPath
    && typeof toStopId === 'string' && Object.hasOwn(stops, toStopId) && fromStopId !== toStopId
    && typeof distanceMeters === 'number' && Number.isSafeInteger(distanceMeters)
    && distanceMeters >= 0 && distanceMeters <= maxTransferDistanceMeters
    && typeof seconds === 'number' && Number.isSafeInteger(seconds)
    && seconds >= Math.ceil(distanceMeters / walkingMetersPerSecond) + transferBufferSeconds && seconds <= maxTransferSeconds
    && isRecord(evidence) && (evidence.type === 'source' || evidence.type === 'cms' || evidence.type === 'manual')
    && typeof evidence.reference === 'string' && evidence.reference.trim() !== ''
    && Buffer.byteLength(evidence.reference) <= maxEvidenceReferenceBytes;
}

async function loadIndexedStopGrid(snapshot: LoadedSnapshot, cell: string, path: string): Promise<Map<string, TransitStop>> {
  const shard = await loadSnapshotShard<unknown>(snapshot, path);
  if (!isRecord(shard) || shard.cell !== cell || shard.precision !== 0.01
    || !Array.isArray(shard.stops) || shard.stops.length === 0) {
    throw new TransitSnapshotError('INVALID_SHARD');
  }
  const indexedStops = snapshot.manifest.indexes.stops;
  const records = new Map<string, TransitStop>();
  for (const stop of shard.stops) {
    if (!isTransitStop(stop) || !Object.hasOwn(indexedStops, stop.stopId) || indexedStops[stop.stopId] !== path
      || records.has(stop.stopId) || getStopGridCell([stop.latitude, stop.longitude]) !== cell) {
      throw new TransitSnapshotError('INVALID_SHARD');
    }
    records.set(stop.stopId, stop);
  }
  return records;
}

export async function loadTransferCandidates(stopIds: string[], snapshot: LoadedSnapshot): Promise<TransitTransfer[]> {
  const { stops, stopGrid, transfers } = snapshot.manifest.indexes;
  const requested = new Set(stopIds.filter((id) => Object.hasOwn(stops, id)));
  if (requested.size === 0) return [];

  const stopPaths = new Set([...requested].map((id) => stops[id]));
  const loadedPaths = new Set<string>();
  const loadedStopGrids = new Map<string, Map<string, TransitStop>>();
  const edges: TransitTransfer[] = [];

  async function readEndpoint(stopId: string, cell: string): Promise<TransitStop> {
    const path = stops[stopId];
    let records = loadedStopGrids.get(path);
    if (!records) {
      records = await loadIndexedStopGrid(snapshot, cell, path);
      loadedStopGrids.set(path, records);
    }
    const stop = records.get(stopId);
    if (!stop) throw new TransitSnapshotError('INVALID_SHARD');
    return stop;
  }

  for (const [cell, stopPath] of Object.entries(stopGrid)) {
    if (!stopPaths.has(stopPath)) continue;
    const path = transfers[cell];
    if (loadedPaths.has(path)) continue;
    loadedPaths.add(path);
    const shard = await loadSnapshotShard<unknown>(snapshot, path);
    if (!isRecord(shard) || shard.cell !== cell || !Array.isArray(shard.transfers)) {
      throw new TransitSnapshotError('INVALID_SHARD');
    }
    const [latitude, longitude] = cell.split('_').map(Number);
    const adjacentCellsByPath = new Map<string, string>();
    for (const neighbor of neighboringGridCells(latitude, longitude)) {
      if (Object.hasOwn(stopGrid, neighbor)) adjacentCellsByPath.set(stopGrid[neighbor], neighbor);
    }

    const destinationsByOrigin = new Map<string, Set<string>>();
    for (const transfer of shard.transfers) {
      if (!isTransfer(transfer, stopPath, stops)) throw new TransitSnapshotError('INVALID_SHARD');
      const { fromStopId, toStopId } = transfer;
      const destinationCell = adjacentCellsByPath.get(stops[toStopId]);
      const destinations = destinationsByOrigin.get(fromStopId) ?? new Set<string>();
      if (!destinationCell || destinations.has(toStopId) || destinations.size >= maxTransferNeighbors) {
        throw new TransitSnapshotError('INVALID_SHARD');
      }
      destinations.add(toStopId);
      destinationsByOrigin.set(fromStopId, destinations);

      const from = await readEndpoint(fromStopId, cell);
      const to = await readEndpoint(toStopId, destinationCell);
      const distance = haversineDistanceMeters([from.latitude, from.longitude], [to.latitude, to.longitude]);
      if (distance > maxTransferDistanceMeters || transfer.distanceMeters < Math.floor(distance)) {
        throw new TransitSnapshotError('INVALID_SHARD');
      }
      if (requested.has(fromStopId)) edges.push(transfer);
    }
  }

  return edges.sort((first, second) =>
    compareIds(first.fromStopId, second.fromStopId) || compareIds(first.toStopId, second.toStopId));
}
