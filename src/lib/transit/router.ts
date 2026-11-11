import type { Coordinate, RoutePreference, TransitConnection, TransitManifest, TransitTransfer } from './contracts.ts';
import { getServiceContext, isServiceActive, serviceTimeToEpochMs, type ServiceDay } from './service-calendar.ts';
import { loadSnapshotShard, TransitSnapshotError, type LoadedSnapshot } from './snapshot-source.ts';
import { createTransferCandidateLoader, estimateWalk } from './spatial.ts';

export interface RouterLimits {
  horizonSeconds: number;
  maxBuckets: number;
  /** Unique transfer and endpoint stop-grid shard paths. */
  maxTransferShards: number;
  maxBoardings: number;
  maxLabelsPerStop: number;
  maxTotalLabels: number;
  maxAlternatives: number;
  wallTimeMs: number;
}

export const DEFAULT_ROUTER_LIMITS: Readonly<RouterLimits> = Object.freeze({
  horizonSeconds: 6 * 3600,
  maxBuckets: 32,
  maxTransferShards: 64,
  maxBoardings: 3,
  maxLabelsPerStop: 8,
  maxTotalLabels: 100_000,
  maxAlternatives: 3,
  wallTimeMs: 1500,
});

const hourSeconds = 3600;
const hourMs = hourSeconds * 1000;
const maxServiceHours = 72;
const hashId = /^[a-f0-9]{64}$/;
const { boardingBufferSeconds, transferBufferSeconds } = estimateWalk(0);
const preferences = ['fastest', 'less-walking', 'fewer-transfers'] as const;

export interface StopWalk {
  stopId: string;
  distanceMeters: number;
  walkingSeconds: number;
}

export interface RouterQuery {
  departureAt: Date;
  origin: Coordinate;
  destination: Coordinate;
  access: readonly StopWalk[];
  egress: readonly StopWalk[];
  preference?: RoutePreference;
  limits?: Partial<RouterLimits>;
}

export interface DatedConnection {
  day: ServiceDay;
  connection: TransitConnection;
}

export interface RouterInput extends RouterQuery {
  connections: readonly DatedConnection[];
  /** Directed transfer edges for the pure scan. The async coordinator loads its own verified edges. */
  transfers?: readonly TransitTransfer[];
}

interface SegmentTime {
  departureEpochMs: number;
  arrivalEpochMs: number;
}

type WalkSegment = SegmentTime & { kind: 'walk'; distanceMeters: number; walkingSeconds: number } & (
  | { role: 'access'; fromCoordinate: Coordinate; toStopId: string }
  | { role: 'transfer'; fromStopId: string; toStopId: string; evidence: TransitTransfer['evidence'] }
  | { role: 'egress'; fromStopId: string; toCoordinate: Coordinate }
);

type Vehicle = Pick<TransitConnection, 'tripId' | 'routeId' | 'serviceId' | 'patternId' | 'shapeId' | 'directionId' | 'headsign'>;

type RideSegment = SegmentTime & Vehicle & {
  kind: 'ride';
  serviceDate: string;
  stopIds: string[];
} & Pick<TransitConnection, 'fromStopId' | 'toStopId' | 'stopSequence' | 'arrivalStopSequence'>;

export type JourneySegment = WalkSegment | RideSegment;

export interface ArrivalLabel {
  readonly index: number;
  readonly stopId: string;
  readonly arrivalEpochMs: number;
  readonly readyEpochMs: number;
  readonly boardings: number;
  readonly walkingSeconds: number;
  readonly predecessor: number | null;
  readonly segment: JourneySegment;
}

export interface RouterState {
  readonly labels: readonly ArrivalLabel[];
}

type RouteBudget = 'buckets' | 'transfer-shards' | 'stop-labels' | 'total-labels' | 'timeout';

/** Data unavailable and integrity failures surface as TransitSnapshotError. */
export type RouterResult = { status: 'ok'; journeys: JourneySegment[][] }
  | { status: 'no-route' }
  | { status: 'budget-exceeded'; budget: RouteBudget };

export type SnapshotRouterResult = RouterResult & {
  diagnostics: {
    connectionBuckets: number;
    connectionShards: number;
    /** Unique transfer and endpoint stop-grid shard reads started. */
    transferShards: number;
  };
};

class BudgetExceeded extends Error {
  readonly budget: RouteBudget;

  constructor(budget: RouteBudget) {
    super(budget);
    this.budget = budget;
  }
}

function budgetResult(error: unknown): RouterResult {
  if (!(error instanceof BudgetExceeded)) throw error;
  return { status: 'budget-exceeded', budget: error.budget };
}

function routerLimits(overrides: Partial<RouterLimits> = {}): RouterLimits {
  const limits = { ...DEFAULT_ROUTER_LIMITS };
  for (const key of Object.keys(limits) as (keyof RouterLimits)[]) {
    const override = overrides[key];
    if (override === undefined) continue;
    if (!Number.isSafeInteger(override) || override < 1 || override > limits[key]) {
      throw new RangeError(`Invalid transit router limit: ${key}`);
    }
    limits[key] = override;
  }
  return limits;
}

function compareIds(first: string, second: string): number {
  return first < second ? -1 : first === second ? 0 : 1;
}

function tripKey(serviceDate: string, tripId: string): string {
  return `${serviceDate}\0${tripId}`;
}

function sameVehicle(first: Vehicle, second: Vehicle): boolean {
  return first.tripId === second.tripId && first.headsign === second.headsign
    && first.serviceId === second.serviceId && first.routeId === second.routeId && first.patternId === second.patternId
    && first.shapeId === second.shapeId && first.directionId === second.directionId;
}

export function reconstructJourney(label: ArrivalLabel, state: RouterState): JourneySegment[] {
  const chain: JourneySegment[] = [];
  for (let current: ArrivalLabel | undefined = label; current;
    current = current.predecessor === null ? undefined : state.labels[current.predecessor]) {
    chain.push(current.segment);
  }

  const journey: JourneySegment[] = [];
  for (const segment of chain.reverse()) {
    const last = journey.at(-1);
    if (last?.kind === 'ride' && segment.kind === 'ride' && last.serviceDate === segment.serviceDate && sameVehicle(last, segment)
      && last.toStopId === segment.fromStopId && last.arrivalStopSequence === segment.stopSequence) {
      if (last.toStopId !== segment.toStopId) last.stopIds.push(segment.toStopId);
      last.toStopId = segment.toStopId;
      last.arrivalStopSequence = segment.arrivalStopSequence;
      last.arrivalEpochMs = segment.arrivalEpochMs;
    } else {
      journey.push(segment.kind === 'ride' ? { ...segment, stopIds: [...segment.stopIds] } : segment);
    }
  }
  return journey;
}

function journeyKey(journey: JourneySegment[]): string {
  return JSON.stringify(journey.map((segment) => {
    if (segment.kind === 'ride') return [segment.serviceDate, segment.tripId, segment.stopSequence, segment.arrivalStopSequence];
    if (segment.role === 'access') return ['access', segment.toStopId];
    if (segment.role === 'egress') return ['egress', segment.fromStopId];
    return ['transfer', segment.fromStopId, segment.toStopId];
  }));
}

function compareMetrics(first: readonly number[], second: readonly number[], preference: RoutePreference): number {
  const time = first[0] - second[0];
  const walking = first[1] - second[1];
  const boardings = first[2] - second[2];
  switch (preference) {
    case 'less-walking': return walking || time || boardings;
    case 'fewer-transfers': return boardings || time || walking;
    case 'fastest': return time || walking || boardings;
  }
}

export function rankJourneys(journeys: JourneySegment[][], preference: RoutePreference): JourneySegment[][] {
  const ranked = journeys.map((journey) => {
    let walking = 0;
    let boardings = 0;
    for (const segment of journey) {
      if (segment.kind === 'walk') walking += segment.walkingSeconds;
      else boardings++;
    }
    return { journey, key: journeyKey(journey), metrics: [journey.at(-1)?.arrivalEpochMs ?? Infinity, walking, boardings] };
  });
  return ranked.sort((a, b) => compareMetrics(a.metrics, b.metrics, preference) || compareIds(a.key, b.key))
    .map(({ journey }) => journey);
}

function dominates(first: ArrivalLabel, second: ArrivalLabel): boolean {
  return first.arrivalEpochMs <= second.arrivalEpochMs && first.readyEpochMs <= second.readyEpochMs
    && first.walkingSeconds <= second.walkingSeconds && first.boardings <= second.boardings;
}

function retainLabel<T extends ArrivalLabel>(frontier: T[], label: T, cap: number,
  canDominate: (first: T, second: T) => boolean = dominates): void {
  if (frontier.some((other) => canDominate(other, label))) return;
  for (let i = frontier.length - 1; i >= 0; i--) {
    if (canDominate(label, frontier[i])) frontier.splice(i, 1);
  }
  if (frontier.length >= cap) throw new BudgetExceeded('stop-labels');
  frontier.push(label);
}

interface ConnectionInstance extends SegmentTime {
  serviceDate: string;
  connection: TransitConnection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isConnection(value: unknown): value is TransitConnection {
  if (!isRecord(value)) return false;
  const { departure, arrival, tripId, routeId, serviceId, serviceClass, directionId, headsign, patternId, shapeId,
    fromStopId, toStopId, stopSequence, arrivalStopSequence, pickupType, dropOffType } = value;
  const maxTime = maxServiceHours * hourSeconds - 1;
  return isIntegerBetween(departure, 0, maxTime) && isIntegerBetween(arrival, departure, maxTime)
    && isId(tripId) && isId(routeId) && isId(serviceId) && isId(fromStopId) && isId(toStopId)
    && typeof serviceClass === 'string' && hashId.test(serviceClass)
    && typeof patternId === 'string' && hashId.test(patternId) && typeof shapeId === 'string' && hashId.test(shapeId)
    && (directionId === '' || directionId === '0' || directionId === '1') && typeof headsign === 'string'
    && isIntegerBetween(stopSequence, 0, Number.MAX_SAFE_INTEGER - 1)
    && isIntegerBetween(arrivalStopSequence, stopSequence + 1, Number.MAX_SAFE_INTEGER)
    && isIntegerBetween(pickupType, 0, 3) && isIntegerBetween(dropOffType, 0, 3);
}

function instantiate(connection: TransitConnection, day: ServiceDay): ConnectionInstance {
  return {
    serviceDate: day.serviceDate, connection,
    departureEpochMs: serviceTimeToEpochMs(day, connection.departure), arrivalEpochMs: serviceTimeToEpochMs(day, connection.arrival),
  };
}

function rideSegment({ serviceDate, departureEpochMs, arrivalEpochMs, connection }: ConnectionInstance): RideSegment {
  const { tripId, routeId, serviceId, patternId, shapeId, directionId, headsign, fromStopId, toStopId,
    stopSequence, arrivalStopSequence } = connection;
  return {
    kind: 'ride', serviceDate, departureEpochMs, arrivalEpochMs, tripId, routeId, serviceId, patternId, shapeId, directionId, headsign,
    fromStopId, toStopId, stopSequence, arrivalStopSequence, stopIds: fromStopId === toStopId ? [fromStopId] : [fromStopId, toStopId],
  };
}

function compareConnections(first: ConnectionInstance, second: ConnectionInstance): number {
  const a = first.connection;
  const b = second.connection;
  return first.departureEpochMs - second.departureEpochMs || first.arrivalEpochMs - second.arrivalEpochMs
    || compareIds(first.serviceDate, second.serviceDate) || compareIds(a.tripId, b.tripId) || a.stopSequence - b.stopSequence
    || compareIds(a.fromStopId, b.fromStopId) || compareIds(a.toStopId, b.toStopId);
}

function compareWalks(first: StopWalk, second: StopWalk): number {
  return first.walkingSeconds - second.walkingSeconds || first.distanceMeters - second.distanceMeters
    || compareIds(first.stopId, second.stopId);
}

function assertStopWalk(walk: StopWalk): void {
  if (!isId(walk.stopId) || !Number.isSafeInteger(walk.walkingSeconds) || walk.walkingSeconds < 0
    || !Number.isFinite(walk.distanceMeters) || walk.distanceMeters < 0) throw new RangeError('Invalid stop walk');
}

interface RideProgress {
  readonly startEpochMs: number;
  readonly moved: boolean;
}

interface ScanLabel extends ArrivalLabel {
  readonly ride: RideProgress | null;
}

class ConnectionScan {
  readonly departureEpochMs: number;
  readonly endEpochMs: number;
  readonly hasEndpoints: boolean;
  private readonly input: RouterQuery;
  private readonly limits: RouterLimits;
  private readonly labels: ScanLabel[] = [];
  private readonly byStop = new Map<string, ScanLabel[]>();
  private readonly onboard = new Map<string, ScanLabel[]>();
  private readonly destinations: ArrivalLabel[] = [];
  private readonly egress = new Map<string, StopWalk>();
  private readonly transfers = new Map<string, TransitTransfer[]>();
  private readonly minimumWalking: number;

  constructor(input: RouterQuery, limits: RouterLimits) {
    this.input = input;
    this.limits = limits;
    this.departureEpochMs = input.departureAt.getTime();
    this.endEpochMs = this.departureEpochMs + limits.horizonSeconds * 1000;
    if (!Number.isFinite(this.departureEpochMs) || !Number.isFinite(new Date(this.endEpochMs).getTime())) {
      throw new RangeError('Invalid transit departure time');
    }

    for (const walk of [...input.egress].sort(compareWalks)) {
      assertStopWalk(walk);
      if (!this.egress.has(walk.stopId)) this.egress.set(walk.stopId, walk);
    }
    const access = [...input.access].sort(compareWalks);
    this.minimumWalking = (access[0]?.walkingSeconds ?? Infinity)
      + (this.egress.values().next().value?.walkingSeconds ?? Infinity);
    this.hasEndpoints = access.length > 0 && this.egress.size > 0;

    for (const walk of access) {
      assertStopWalk(walk);
      const arrival = this.departureEpochMs + walk.walkingSeconds * 1000;
      if (arrival + boardingBufferSeconds * 1000 >= this.endEpochMs) continue;
      const segment: WalkSegment = {
        kind: 'walk', role: 'access', fromCoordinate: input.origin, toStopId: walk.stopId,
        departureEpochMs: this.departureEpochMs, arrivalEpochMs: arrival,
        distanceMeters: walk.distanceMeters, walkingSeconds: walk.walkingSeconds,
      };
      const label = this.addLabel(walk.stopId, arrival + boardingBufferSeconds * 1000, 0, walk.walkingSeconds, null, segment);
      this.retainAtStop(label);
    }
  }

  addTransfers(transfers: readonly TransitTransfer[]): void {
    const touched = new Set<TransitTransfer[]>();
    for (const transfer of transfers) {
      const walk = estimateWalk(transfer.distanceMeters);
      if (!Number.isSafeInteger(transfer.seconds) || transfer.seconds < walk.walkingSeconds + walk.transferBufferSeconds
        || transfer.fromStopId === transfer.toStopId) throw new TransitSnapshotError('INVALID_SHARD');
      const edges = this.transfers.get(transfer.fromStopId) ?? [];
      if (!edges.some((edge) => edge.toStopId === transfer.toStopId)) edges.push(transfer);
      this.transfers.set(transfer.fromStopId, edges);
      touched.add(edges);
    }
    for (const edges of touched) edges.sort((a, b) => compareIds(a.toStopId, b.toStopId));
  }

  private addLabel(stopId: string, readyEpochMs: number, boardings: number, walkingSeconds: number,
    predecessor: ArrivalLabel | null, segment: JourneySegment, ride: RideProgress | null = null): ScanLabel {
    if (this.labels.length >= this.limits.maxTotalLabels) throw new BudgetExceeded('total-labels');
    const label = {
      index: this.labels.length, stopId, arrivalEpochMs: segment.arrivalEpochMs, readyEpochMs,
      boardings, walkingSeconds, predecessor: predecessor?.index ?? null, segment, ride,
    };
    this.labels.push(label);
    return label;
  }

  private retainAtStop(label: ScanLabel): void {
    const frontier = this.byStop.get(label.stopId) ?? [];
    retainLabel(frontier, label, this.limits.maxLabelsPerStop, this.dominatesForContinuation);
    this.byStop.set(label.stopId, frontier);
  }

  private readonly dominatesForContinuation = (first: ScanLabel, second: ScanLabel): boolean => {
    if (!dominates(first, second)) return false;
    const visited = new Set<string>();
    const trips = new Set<string>();
    for (let label: ArrivalLabel | undefined = second; label;
      label = label.predecessor === null ? undefined : this.labels[label.predecessor]) {
      visited.add(label.stopId);
      if (label.segment.kind === 'ride') trips.add(tripKey(label.segment.serviceDate, label.segment.tripId));
    }
    for (let label: ArrivalLabel | undefined = first; label;
      label = label.predecessor === null ? undefined : this.labels[label.predecessor]) {
      // Once the chains meet, all remaining history is shared.
      if (label.index === second.index) return true;
      if (!visited.has(label.stopId) || (label.segment.kind === 'ride'
        && !trips.has(tripKey(label.segment.serviceDate, label.segment.tripId)))) return false;
    }
    return true;
  };

  private canVisit(parent: ArrivalLabel, stopId: string | undefined, boarding?: ConnectionInstance): boolean {
    for (let label: ArrivalLabel | undefined = parent; label;
      label = label.predecessor === null ? undefined : this.labels[label.predecessor]) {
      if (label.stopId === stopId || (boarding && label.segment.kind === 'ride'
        && label.segment.serviceDate === boarding.serviceDate && label.segment.tripId === boarding.connection.tripId)) return false;
    }
    return true;
  }

  private considerEgress(parent: ArrivalLabel): void {
    const walk = this.egress.get(parent.stopId);
    if (!walk) return;
    const arrival = parent.arrivalEpochMs + walk.walkingSeconds * 1000;
    if (arrival > this.endEpochMs) return;
    const walkingSeconds = parent.walkingSeconds + walk.walkingSeconds;
    if (this.destinations.some((label) => label.arrivalEpochMs <= arrival
      && label.walkingSeconds <= walkingSeconds && label.boardings <= parent.boardings)) return;
    const segment: WalkSegment = {
      kind: 'walk', role: 'egress', fromStopId: parent.stopId, toCoordinate: this.input.destination,
      departureEpochMs: parent.arrivalEpochMs, arrivalEpochMs: arrival,
      distanceMeters: walk.distanceMeters, walkingSeconds: walk.walkingSeconds,
    };
    const label = this.addLabel(parent.stopId, arrival, parent.boardings, walkingSeconds, parent, segment);
    retainLabel(this.destinations, label, this.limits.maxTotalLabels);
  }

  alight(label: ScanLabel): void {
    this.considerEgress(label);
    this.retainAtStop(label);
  }

  expandTransfers(label: ScanLabel): void {
    for (const edge of this.transfers.get(label.stopId) ?? []) {
      const arrival = label.arrivalEpochMs + edge.seconds * 1000;
      if (arrival > this.endEpochMs || !this.canVisit(label, edge.toStopId)) continue;
      const walkingSeconds = estimateWalk(edge.distanceMeters).walkingSeconds;
      const segment: WalkSegment = {
        kind: 'walk', role: 'transfer', fromStopId: edge.fromStopId, toStopId: edge.toStopId, evidence: edge.evidence,
        departureEpochMs: label.arrivalEpochMs, arrivalEpochMs: arrival, distanceMeters: edge.distanceMeters, walkingSeconds,
      };
      const transferred = this.addLabel(edge.toStopId, arrival, label.boardings, label.walkingSeconds + walkingSeconds, label, segment);
      this.considerEgress(transferred);
      this.retainAtStop(transferred);
    }
  }

  advance(instance: ConnectionInstance): ScanLabel[] {
    const { connection, serviceDate, departureEpochMs, arrivalEpochMs } = instance;
    const { tripId, fromStopId, toStopId, stopSequence } = connection;
    const stationary = fromStopId === toStopId;
    if (departureEpochMs < this.departureEpochMs || arrivalEpochMs > this.endEpochMs) return [];
    // A consecutive entry at the current stop advances the trip sequence without a physical revisit.
    const nextStop = stationary ? undefined : toStopId;

    const key = tripKey(serviceDate, tripId);
    const continuation = this.onboard.get(key) ?? [];
    const candidates: { parent: ScanLabel; boardings: number; ride: RideProgress }[] = [];
    for (const label of continuation) {
      const last = label.segment;
      if (label.ride && last.kind === 'ride' && label.stopId === fromStopId && last.arrivalStopSequence === stopSequence
        && label.arrivalEpochMs <= departureEpochMs && sameVehicle(last, connection) && this.canVisit(label, nextStop)) {
        candidates.push({ parent: label, boardings: label.boardings,
          ride: { startEpochMs: label.ride.startEpochMs, moved: label.ride.moved || !stationary } });
      }
    }
    if (connection.pickupType === 0) {
      for (const label of this.byStop.get(fromStopId) ?? []) {
        if (label.boardings < this.limits.maxBoardings && label.readyEpochMs <= departureEpochMs
          && this.canVisit(label, nextStop, instance)) {
          candidates.push({ parent: label, boardings: label.boardings + 1,
            ride: { startEpochMs: departureEpochMs, moved: !stationary } });
        }
      }
    }

    if (candidates.length === 0) {
      this.onboard.delete(key);
      return [];
    }
    const next: ScanLabel[] = [];
    const segment = rideSegment(instance);
    const hasPositiveDuration = (label: ScanLabel) => label.ride !== null && label.arrivalEpochMs > label.ride.startEpochMs;
    for (const { parent, boardings, ride } of candidates) {
      const label = this.addLabel(toStopId, arrivalEpochMs + transferBufferSeconds * 1000,
        boardings, parent.walkingSeconds, parent, segment, ride);
      // A rider needs both movement and elapsed time before an alighting can enter a journey.
      retainLabel(next, label, candidates.length, (first, second) =>
        (first.ride?.moved || !second.ride?.moved) && (!hasPositiveDuration(second) || hasPositiveDuration(first))
        && this.dominatesForContinuation(first, second));
    }
    if (next.length > this.limits.maxLabelsPerStop) throw new BudgetExceeded('stop-labels');
    this.onboard.set(key, next);
    return connection.dropOffType === 0 ? next.filter((label) => label.ride?.moved && hasPositiveDuration(label)) : [];
  }

  canImprove(nextDepartureEpochMs: number): boolean {
    if (!this.hasEndpoints || nextDepartureEpochMs > this.endEpochMs) return false;
    // A later arrival cannot improve a route already at the walking and boarding lower bounds.
    return !this.destinations.some((label) => label.arrivalEpochMs <= nextDepartureEpochMs
      && label.walkingSeconds === this.minimumWalking && label.boardings === 1);
  }

  result(): RouterResult {
    if (this.destinations.length === 0) return { status: 'no-route' };
    const state = { labels: this.labels };
    const candidates = this.destinations.map((label) => reconstructJourney(label, state));
    const choices = new Set<JourneySegment[]>();
    const seen = new Set<string>();
    const add = (journey: JourneySegment[]) => {
      const key = journeyKey(journey);
      if (choices.size >= this.limits.maxAlternatives || seen.has(key)) return;
      seen.add(key);
      choices.add(journey);
    };
    // Keep the leading option for each preference before filling spare slots by arrival time.
    const fastest = rankJourneys(candidates, 'fastest');
    for (const preference of preferences) add(preference === 'fastest' ? fastest[0] : rankJourneys(candidates, preference)[0]);
    for (const journey of fastest) add(journey);
    return { status: 'ok', journeys: rankJourneys([...choices], this.input.preference ?? 'fastest') };
  }
}

export function scanTransitConnections(input: RouterInput): RouterResult {
  const limits = routerLimits(input.limits);
  try {
    const scan = new ConnectionScan(input, limits);
    scan.addTransfers(input.transfers ?? []);
    const instances = input.connections.map(({ day, connection }) => {
      if (!isConnection(connection)) throw new TransitSnapshotError('INVALID_SHARD');
      return instantiate(connection, day);
    }).sort(compareConnections);
    let previous: ConnectionInstance | undefined;
    for (const instance of instances) {
      if (!scan.canImprove(instance.departureEpochMs)) break;
      if (!previous || compareConnections(previous, instance) !== 0) {
        for (const label of scan.advance(instance)) {
          scan.alight(label);
          scan.expandTransfers(label);
        }
      }
      previous = instance;
    }
    return scan.result();
  } catch (error) {
    return budgetResult(error);
  }
}

interface Bucket {
  classId: string;
  hour: number;
  path: string;
  day: ServiceDay;
  startEpochMs: number;
}

function selectBuckets(manifest: TransitManifest, departure: number, end: number, checkTime: () => void): Bucket[] {
  const start = getServiceContext(new Date(departure), manifest);
  const finish = getServiceContext(new Date(end), manifest);
  const days = new Map([...start.serviceDays, ...finish.serviceDays].map((day) => [day.serviceDate, day]));
  const selected: Bucket[] = [];
  for (const day of days.values()) {
    const context = { ...start, serviceDays: [day] };
    const firstHour = Math.max(0, Math.floor((departure - day.anchorEpochMs) / hourMs));
    const lastHour = Math.min(maxServiceHours - 1, Math.floor((end - day.anchorEpochMs) / hourMs));
    for (const [classId, { serviceIds }] of Object.entries(manifest.indexes.serviceClasses)) {
      checkTime();
      if (serviceIds.length === 0 || !isServiceActive(serviceIds[0], context, day.serviceDate)) continue;
      for (let hour = firstHour; hour <= lastHour; hour++) {
        const key = `${classId}-${String(hour).padStart(2, '0')}`;
        const path = manifest.indexes.connectionBuckets[key];
        if (path) selected.push({ classId, hour, path, day, startEpochMs: day.anchorEpochMs + hour * hourMs });
      }
    }
  }
  return selected.sort((a, b) => a.startEpochMs - b.startEpochMs || compareIds(a.path, b.path)
    || compareIds(a.day.serviceDate, b.day.serviceDate));
}

function compareProducerConnections(first: TransitConnection, second: TransitConnection): number {
  return first.departure - second.departure || first.arrival - second.arrival
    // PHP strcmp orders UTF-8 bytes, including trip IDs containing supplementary characters.
    || (first.tripId === second.tripId ? 0 : Buffer.compare(Buffer.from(first.tripId), Buffer.from(second.tripId)))
    || first.stopSequence - second.stopSequence;
}

function readBucket(payload: unknown, bucket: Bucket, manifest: TransitManifest,
  previousByTrip: Map<string, TransitConnection>, checkTime: () => void): TransitConnection[] {
  if (!isRecord(payload) || !Array.isArray(payload.connections) || payload.connections.length === 0) {
    throw new TransitSnapshotError('INVALID_SHARD');
  }
  const indexes = manifest.indexes;
  const context = { calendars: indexes, serviceDays: [bucket.day], serviceDate: bucket.day.serviceDate,
    localDepartureSeconds: bucket.day.departureSeconds, departureEpochMs: bucket.startEpochMs };
  const serviceIds = new Set<string>();
  let previousRecord: TransitConnection | undefined;
  for (const record of payload.connections) {
    checkTime();
    if (!isConnection(record) || record.serviceClass !== bucket.classId || Math.floor(record.departure / hourSeconds) !== bucket.hour
      || !Object.hasOwn(indexes.stops, record.fromStopId) || !Object.hasOwn(indexes.stops, record.toStopId)
      || !Object.hasOwn(indexes.routes, record.routeId) || !Object.hasOwn(indexes.patterns, record.patternId)
      || !Object.hasOwn(indexes.shapes, record.shapeId) || !Object.hasOwn(indexes.calendarRules, record.serviceId)
      || indexes.calendarRules[record.serviceId] !== bucket.classId) throw new TransitSnapshotError('INVALID_SHARD');
    if (!serviceIds.has(record.serviceId)) {
      if (!isServiceActive(record.serviceId, context, bucket.day.serviceDate)) throw new TransitSnapshotError('INVALID_SHARD');
      serviceIds.add(record.serviceId);
    }
    if (previousRecord && compareProducerConnections(previousRecord, record) >= 0) {
      throw new TransitSnapshotError('INVALID_SHARD');
    }
    // Bucket windows for one service date are loaded in hour order. Validate the whole
    // observed trip before the caller filters the records to the departure interval.
    const key = tripKey(bucket.day.serviceDate, record.tripId);
    const previousTripEdge = previousByTrip.get(key);
    if (previousTripEdge && (previousTripEdge.arrival > record.departure
      || previousTripEdge.arrivalStopSequence !== record.stopSequence
      || previousTripEdge.toStopId !== record.fromStopId || !sameVehicle(previousTripEdge, record))) {
      throw new TransitSnapshotError('INVALID_SHARD');
    }
    previousByTrip.set(key, record);
    previousRecord = record;
  }
  return payload.connections as TransitConnection[];
}

interface SnapshotRouterOptions {
  /** Monotonic milliseconds. Useful for deterministic deadline tests. */
  clock?: () => number;
}

/** Route against the captured version, loading only the next relevant connection bucket(s). */
export async function routeTransitSnapshot(snapshot: LoadedSnapshot, input: RouterQuery,
  { clock = () => performance.now() }: SnapshotRouterOptions = {}): Promise<SnapshotRouterResult> {
  const limits = routerLimits(input.limits);
  const deadline = clock() + limits.wallTimeMs;
  const diagnostics = { connectionBuckets: 0, connectionShards: 0, transferShards: 0 };
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const checkTime = () => {
    if (expired || clock() >= deadline) throw new BudgetExceeded('timeout');
  };

  async function run(): Promise<RouterResult> {
    checkTime();
    const scan = new ConnectionScan(input, limits);
    if (!scan.hasEndpoints) return scan.result();
    const buckets = selectBuckets(snapshot.manifest, scan.departureEpochMs, scan.endEpochMs, checkTime);
    const paths = new Map<string, number>();
    for (const bucket of buckets) paths.set(bucket.path, (paths.get(bucket.path) ?? 0) + 1);
    const reused = new Map<string, unknown>();
    const previousByTrip = new Map<string, TransitConnection>();
    const loadedTransferCells = new Set<string>();
    const transferReadPaths = new Set<string>();
    const readTransfers = createTransferCandidateLoader(snapshot, (path) => {
      checkTime();
      if (transferReadPaths.has(path)) return;
      if (transferReadPaths.size >= limits.maxTransferShards) throw new BudgetExceeded('transfer-shards');
      transferReadPaths.add(path);
      diagnostics.transferShards = transferReadPaths.size;
    });
    let stopsByGridPath: Map<string, string[]> | undefined;
    let pending: ConnectionInstance[] = [];

    async function loadTransfers(gridPath: string) {
      if (!stopsByGridPath) {
        stopsByGridPath = new Map<string, string[]>();
        for (const [id, path] of Object.entries(snapshot.manifest.indexes.stops)) {
          checkTime();
          const ids = stopsByGridPath.get(path) ?? [];
          ids.push(id);
          stopsByGridPath.set(path, ids);
        }
      }
      checkTime();
      // Load the entire origin cell on its first reached alighting stop, so later stops
      // in this cell can expand synchronously without another transfer shard read.
      const transfers = await readTransfers(stopsByGridPath.get(gridPath)!);
      checkTime();
      scan.addTransfers(transfers);
      loadedTransferCells.add(gridPath);
    }

    // Historical offsets can shift one dated bucket across another bucket's boundary.
    // Flush only departures strictly before the next bucket can begin.
    for (const [index, bucket] of buckets.entries()) {
      checkTime();
      if (!scan.canImprove(bucket.startEpochMs)) break;
      if (index >= limits.maxBuckets) throw new BudgetExceeded('buckets');
      diagnostics.connectionBuckets++;
      let payload = reused.get(bucket.path);
      if (payload === undefined) {
        diagnostics.connectionShards++;
        payload = await loadSnapshotShard<unknown>(snapshot, bucket.path);
      }
      checkTime();
      const remaining = paths.get(bucket.path)! - 1;
      paths.set(bucket.path, remaining);
      if (remaining > 0) reused.set(bucket.path, payload);
      else reused.delete(bucket.path);

      for (const record of readBucket(payload, bucket, snapshot.manifest, previousByTrip, checkTime)) {
        checkTime();
        const departure = bucket.day.anchorEpochMs + record.departure * 1000;
        if (departure >= scan.departureEpochMs && departure <= scan.endEpochMs) pending.push(instantiate(record, bucket.day));
      }
      const nextStart = buckets[index + 1]?.startEpochMs ?? Infinity;
      if (nextStart === bucket.startEpochMs) continue;
      pending.sort(compareConnections);
      let offset = 0;
      for (; offset < pending.length && pending[offset].departureEpochMs < nextStart; offset++) {
        checkTime();
        const instance = pending[offset];
        if (!scan.canImprove(instance.departureEpochMs)) continue;
        const alighted = scan.advance(instance);
        for (const label of alighted) scan.alight(label);
        if (alighted.length > 0 && instance.arrivalEpochMs < scan.endEpochMs && scan.canImprove(instance.arrivalEpochMs)) {
          const gridPath = snapshot.manifest.indexes.stops[instance.connection.toStopId];
          if (!loadedTransferCells.has(gridPath)) await loadTransfers(gridPath);
          for (const label of alighted) scan.expandTransfers(label);
        }
      }
      pending = pending.slice(offset);
    }
    const result = scan.result();
    checkTime();
    return result;
  }

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new BudgetExceeded('timeout'));
      }, limits.wallTimeMs);
    });
    return { ...await Promise.race([run(), timeout]), diagnostics };
  } catch (error) {
    if (expired || clock() >= deadline) return { status: 'budget-exceeded', budget: 'timeout', diagnostics };
    return { ...budgetResult(error), diagnostics };
  } finally {
    clearTimeout(timer);
  }
}
