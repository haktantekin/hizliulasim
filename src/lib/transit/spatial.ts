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

export function getNearbyStopGridCells(point: Coordinate): string[] {
  if (!isCoordinate(point)) return [];
  const latitude = gridCellNumber(point[0]);
  const longitude = gridCellNumber(point[1]);
  const cells: string[] = [];
  for (let latOffset = -1; latOffset <= 1; latOffset++) {
    for (let lngOffset = -1; lngOffset <= 1; lngOffset++) {
      cells.push(`${latitude + latOffset}_${longitude + lngOffset}`);
    }
  }
  return cells;
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

function sameTransfer(first: TransitTransfer, second: TransitTransfer): boolean {
  return first.distanceMeters === second.distanceMeters && first.seconds === second.seconds
    && first.evidence.type === second.evidence.type && first.evidence.reference === second.evidence.reference;
}

export async function loadTransferCandidates(stopIds: string[], snapshot: LoadedSnapshot): Promise<TransitTransfer[]> {
  const { stops, stopGrid, transfers } = snapshot.manifest.indexes;
  const requested = new Set(stopIds.filter((id) => Object.hasOwn(stops, id)));
  if (requested.size === 0) return [];

  const stopPaths = new Set([...requested].map((id) => stops[id]));
  const loadedPaths = new Set<string>();
  const edges = new Map<string, TransitTransfer>();
  for (const [cell, stopPath] of Object.entries(stopGrid)) {
    if (!stopPaths.has(stopPath)) continue;
    const path = transfers[cell];
    if (loadedPaths.has(path)) continue;
    loadedPaths.add(path);
    const shard = await loadSnapshotShard<unknown>(snapshot, path);
    if (!isRecord(shard) || shard.cell !== cell || !Array.isArray(shard.transfers)) {
      throw new TransitSnapshotError('INVALID_SHARD');
    }
    for (const transfer of shard.transfers) {
      if (!isTransfer(transfer, stopPath, stops)) throw new TransitSnapshotError('INVALID_SHARD');
      const key = JSON.stringify([transfer.fromStopId, transfer.toStopId]);
      const existing = edges.get(key);
      if (existing && !sameTransfer(existing, transfer)) throw new TransitSnapshotError('INVALID_SHARD');
      if (!existing) edges.set(key, transfer);
    }
  }

  return [...edges.values()]
    .filter(({ fromStopId }) => requested.has(fromStopId))
    .sort((first, second) => compareIds(first.fromStopId, second.fromStopId) || compareIds(first.toStopId, second.toStopId));
}
