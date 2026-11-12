import type { Coordinate, RoutePreference, RouteTravelMode, TransitConnection, TransitManifest, TransitMode,
  TransitTransfer } from './contracts.ts';
import { getServiceContext, isServiceActive, serviceTimeToEpochMs, type ServiceDay } from './service-calendar.ts';
import { loadSnapshotTransferGraph, streamSnapshotConnections, TransitSnapshotError,
  type LoadedSnapshot } from './snapshot-source.ts';
import { createTransferCandidateLoader, estimateWalk } from './spatial.ts';

export interface RouterLimits {
  horizonSeconds: number;
  maxBuckets: number;
  /** Unique transfer and endpoint stop-grid shard paths. */
  maxTransferShards: number | null;
  maxBoardings: number;
  maxLabelsPerStop: number | null;
  maxTotalLabels: number;
  maxAlternatives: number;
  wallTimeMs: number | null;
}

export const DEFAULT_ROUTER_LIMITS: Readonly<RouterLimits> = Object.freeze({
  horizonSeconds: 6 * 3600,
  maxBuckets: 32,
  maxTransferShards: null,
  maxBoardings: 4,
  maxLabelsPerStop: null,
  maxTotalLabels: 100_000,
  maxAlternatives: 3,
  wallTimeMs: null,
});

const hourSeconds = 3600;
const hourMs = hourSeconds * 1000;
const maxServiceHours = 72;
const maxDominatedHistoryVariants = 8;
const hashId = /^[a-f0-9]{64}$/;
const { boardingBufferSeconds, transferBufferSeconds } = estimateWalk(0);
const preferences = ['fastest', 'less-walking', 'fewer-transfers'] as const;
const allTransitModes = ['bus', 'metro', 'tram', 'rail', 'ferry', 'funicular', 'cable_car', 'minibus'] as const;
type VehicleMode = Exclude<TransitMode, 'walking'>;

export function getAllowedTransitModes(travelMode: RouteTravelMode): ReadonlySet<VehicleMode> {
  if (travelMode === 'walking') return new Set();
  if (travelMode === 'bus') return new Set(['bus', 'minibus']);
  if (travelMode === 'metro') return new Set(['metro', 'tram', 'rail', 'funicular', 'cable_car']);
  return new Set(allTransitModes);
}

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
  /** Vehicle modes enforced while expanding topology edges, not after route selection. */
  allowedModes?: ReadonlySet<VehicleMode>;
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
    /** Present for schema-v2 searches after its compact transfer graph is validated. */
    transferGraphLoaded?: boolean;
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
  const boundedKeys = [
    'horizonSeconds', 'maxBuckets', 'maxBoardings', 'maxTotalLabels', 'maxAlternatives',
  ] as const;
  for (const key of boundedKeys) {
    const override = overrides[key];
    if (override === undefined) continue;
    if (!Number.isSafeInteger(override) || override < 1 || override > limits[key]) {
      throw new RangeError(`Invalid transit router limit: ${key}`);
    }
    limits[key] = override;
  }
  for (const key of ['maxTransferShards', 'maxLabelsPerStop', 'wallTimeMs'] as const) {
    const override = overrides[key];
    if (override === undefined) continue;
    if (override !== null && (!Number.isSafeInteger(override) || override < 1)) {
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

  return mergeJourneySegments(chain);
}

function mergeJourneySegments(reverseChain: JourneySegment[]): JourneySegment[] {
  const journey: JourneySegment[] = [];
  for (const segment of reverseChain.reverse()) {
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

function retainLabel<T extends ArrivalLabel>(frontier: T[], label: T, cap: number | null,
  canDominate: (first: T, second: T) => boolean = dominates): boolean {
  if (frontier.some((other) => canDominate(other, label))) return false;
  for (let i = frontier.length - 1; i >= 0; i--) {
    if (canDominate(label, frontier[i])) frontier.splice(i, 1);
  }
  if (cap !== null && frontier.length >= cap) throw new BudgetExceeded('stop-labels');
  frontier.push(label);
  return true;
}

function pruneMetricDominatedHistories<T extends ArrivalLabel>(frontier: T[]): void {
  const skyline = new Set(frontier.filter((label, index) => !frontier.some((other, otherIndex) => {
    if (index === otherIndex || !dominates(other, label)) return false;
    const equivalent = dominates(label, other);
    return !equivalent || otherIndex < index;
  })));
  let exceptions = 0;
  for (let index = frontier.length - 1; index >= 0; index--) {
    const label = frontier[index];
    if (skyline.has(label)) continue;
    exceptions++;
    if (exceptions > maxDominatedHistoryVariants) frontier.splice(index, 1);
  }
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
    && isIntegerBetween(pickupType, 0, 3) && isIntegerBetween(dropOffType, 0, 3)
    && (value.mode === undefined || allTransitModes.includes(value.mode as VehicleMode))
    && (value.durationSecondsEstimated === undefined || typeof value.durationSecondsEstimated === 'boolean');
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
  readonly parent: ScanLabel | null;
}

class ConnectionScan {
  readonly departureEpochMs: number;
  readonly endEpochMs: number;
  readonly hasEndpoints: boolean;
  private readonly input: RouterQuery;
  private readonly limits: RouterLimits;
  private readonly byStop = new Map<string, ScanLabel[]>();
  private readonly onboard = new Map<string, ScanLabel[]>();
  private readonly destinations: ScanLabel[] = [];
  private readonly egress = new Map<string, StopWalk>();
  private readonly transfers = new Map<string, TransitTransfer[]>();
  private readonly minimumWalking: number;
  private nextLabelIndex = 0;
  private readonly rootReferences = new Map<ScanLabel, number>();

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

  private createLabel(stopId: string, readyEpochMs: number, boardings: number, walkingSeconds: number,
    predecessor: ArrivalLabel | null, segment: JourneySegment, ride: RideProgress | null = null,
  ): ScanLabel {
    const parent = predecessor as ScanLabel | null;
    return {
      index: this.nextLabelIndex++, stopId, arrivalEpochMs: segment.arrivalEpochMs, readyEpochMs,
      boardings, walkingSeconds, predecessor: predecessor?.index ?? null, segment, ride, parent,
    };
  }

  private replaceRoots(previous: readonly ScanLabel[], next: readonly ScanLabel[]): void {
    for (const label of previous) {
      const references = this.rootReferences.get(label)! - 1;
      if (references === 0) this.rootReferences.delete(label);
      else this.rootReferences.set(label, references);
    }
    for (const label of next) this.rootReferences.set(label, (this.rootReferences.get(label) ?? 0) + 1);
    if (this.rootReferences.size > this.limits.maxTotalLabels) throw new BudgetExceeded('total-labels');
  }

  private addLabel(stopId: string, readyEpochMs: number, boardings: number, walkingSeconds: number,
    predecessor: ArrivalLabel | null, segment: JourneySegment, ride: RideProgress | null = null): ScanLabel {
    return this.createLabel(stopId, readyEpochMs, boardings, walkingSeconds, predecessor, segment, ride);
  }

  private retainAtStop(label: ScanLabel): boolean {
    const frontier = this.byStop.get(label.stopId) ?? [];
    const previous = [...frontier];
    retainLabel(frontier, label, this.limits.maxLabelsPerStop, this.dominatesForContinuation);
    pruneMetricDominatedHistories(frontier);
    const retained = frontier.includes(label);
    this.byStop.set(label.stopId, frontier);
    this.replaceRoots(previous, frontier);
    return retained;
  }

  private static labelStops(label: ScanLabel): readonly string[] {
    return label.segment.kind === 'ride' ? label.segment.stopIds : [label.stopId];
  }

  private readonly dominatesForContinuation = (first: ScanLabel, second: ScanLabel): boolean => {
    if (!dominates(first, second)) return false;
    const visited = new Set<string>();
    const trips = new Set<string>();
    for (let label: ScanLabel | null = second; label; label = label.parent) {
      for (const stopId of ConnectionScan.labelStops(label)) visited.add(stopId);
      if (label.segment.kind === 'ride') trips.add(tripKey(label.segment.serviceDate, label.segment.tripId));
    }
    for (let label: ScanLabel | null = first; label; label = label.parent) {
      // Once the chains meet, all remaining history is shared.
      if (label.index === second.index) return true;
      if (ConnectionScan.labelStops(label).some((stopId) => !visited.has(stopId)) || (label.segment.kind === 'ride'
        && !trips.has(tripKey(label.segment.serviceDate, label.segment.tripId)))) return false;
    }
    return true;
  };

  private canVisit(parent: ArrivalLabel, stopId: string | undefined, boarding?: ConnectionInstance): boolean {
    for (let label: ScanLabel | null = parent as ScanLabel; label; label = label.parent) {
      if ((stopId !== undefined && ConnectionScan.labelStops(label).includes(stopId))
        || (boarding && label.segment.kind === 'ride'
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
    const previous = [...this.destinations];
    retainLabel(this.destinations, label, null);
    this.replaceRoots(previous, this.destinations);
  }

  alight(label: ScanLabel): boolean {
    this.considerEgress(label);
    return this.retainAtStop(label);
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
      this.replaceRoots(continuation, []);
      return [];
    }
    const staged: ScanLabel[] = [];
    const hasPositiveDuration = (label: ScanLabel) => label.ride !== null && label.arrivalEpochMs > label.ride.startEpochMs;
    for (const { parent, boardings, ride } of candidates) {
      const edge = rideSegment(instance);
      const previousRide = parent.segment.kind === 'ride' && parent.ride !== null
        && parent.segment.serviceDate === serviceDate && sameVehicle(parent.segment, connection)
        && parent.segment.toStopId === connection.fromStopId
        && parent.segment.arrivalStopSequence === connection.stopSequence ? parent.segment : undefined;
      const segment: RideSegment = previousRide ? {
        ...previousRide,
        toStopId: edge.toStopId,
        arrivalStopSequence: edge.arrivalStopSequence,
        arrivalEpochMs: edge.arrivalEpochMs,
        stopIds: previousRide.toStopId === edge.toStopId
          ? [...previousRide.stopIds]
          : [...previousRide.stopIds, edge.toStopId],
      } : edge;
      const predecessor = previousRide ? parent.parent : parent;
      const label = this.createLabel(toStopId, arrivalEpochMs + transferBufferSeconds * 1000,
        boardings, parent.walkingSeconds, predecessor, segment, ride);
      // A rider needs both movement and elapsed time before an alighting can enter a journey.
      retainLabel(staged, label, candidates.length, (first, second) =>
        (first.ride?.moved || !second.ride?.moved) && (!hasPositiveDuration(second) || hasPositiveDuration(first))
        && this.dominatesForContinuation(first, second));
    }
    const next = staged;
    if (this.limits.maxLabelsPerStop !== null && next.length > this.limits.maxLabelsPerStop) {
      throw new BudgetExceeded('stop-labels');
    }
    this.onboard.set(key, next);
    this.replaceRoots(continuation, next);
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
    const candidates = this.destinations.map((label) => {
      const chain: JourneySegment[] = [];
      for (let current: ScanLabel | null = label; current; current = current.parent) chain.push(current.segment);
      return mergeJourneySegments(chain);
    });
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
          if (scan.alight(label)) scan.expandTransfers(label);
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

/** The scan needs every bucket at the first start time before it can process departures. */
export function getStartupConnectionPaths(manifest: TransitManifest, departureAt: Date, overrides: Partial<RouterLimits>,
  checkTime: () => void): string[] {
  const { horizonSeconds, maxBuckets } = routerLimits(overrides);
  const departure = departureAt.getTime();
  const buckets = selectBuckets(manifest, departure, departure + horizonSeconds * 1000, checkTime);
  const firstStart = buckets[0]?.startEpochMs;
  const paths = new Set<string>();
  for (const bucket of buckets.slice(0, maxBuckets)) {
    if (bucket.startEpochMs !== firstStart) break;
    paths.add(bucket.path);
  }
  return [...paths];
}

function selectTopologyBuckets(manifest: TransitManifest, departureAt: Date, overrides: Partial<RouterLimits>,
  checkTime: () => void): Bucket[] {
  const limits = routerLimits(overrides);
  const context = getServiceContext(departureAt, manifest);
  const day = context.serviceDays.find((candidate) => candidate.serviceDate === context.serviceDate);
  if (!day) return [];
  const representativeTime = day.anchorEpochMs + 10 * hourMs;
  const buckets = selectBuckets(manifest, representativeTime, representativeTime + hourMs - 1, checkTime);
  const firstStart = buckets[0]?.startEpochMs;
  return buckets.filter((bucket) => bucket.startEpochMs === firstStart).slice(0, limits.maxBuckets);
}

/** A representative daytime bucket supplies a schedule-independent route topology. */
export function getTopologyConnectionPaths(manifest: TransitManifest, departureAt: Date,
  overrides: Partial<RouterLimits>, checkTime: () => void): string[] {
  return [...new Set(selectTopologyBuckets(manifest, departureAt, overrides, checkTime).map(({ path }) => path))];
}

function compareProducerConnections(first: TransitConnection, second: TransitConnection): number {
  return first.departure - second.departure || first.arrival - second.arrival
    // PHP strcmp orders UTF-8 bytes, including trip IDs containing supplementary characters.
    || (first.tripId === second.tripId ? 0 : Buffer.compare(Buffer.from(first.tripId), Buffer.from(second.tripId)))
    || first.stopSequence - second.stopSequence;
}

async function* streamBucket(snapshot: LoadedSnapshot, bucket: Bucket, manifest: TransitManifest,
  checkTime: () => void): AsyncGenerator<ConnectionInstance> {
  const indexes = manifest.indexes;
  const context = { calendars: indexes, serviceDays: [bucket.day], serviceDate: bucket.day.serviceDate,
    localDepartureSeconds: bucket.day.departureSeconds, departureEpochMs: bucket.startEpochMs };
  const serviceIds = new Set<string>();
  let previousRecord: TransitConnection | undefined;
  let records = 0;
  for await (const value of streamSnapshotConnections(snapshot, bucket.path, { checkTime })) {
    checkTime();
    const record = value as TransitConnection;
    if (!isConnection(record) || record.serviceClass !== bucket.classId || Math.floor(record.departure / hourSeconds) !== bucket.hour
      || (manifest.schemaVersion === 2 && record.mode === undefined)
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
    previousRecord = record;
    records++;
    yield instantiate(record, bucket.day);
  }
  if (records === 0) throw new TransitSnapshotError('INVALID_SHARD');
}

interface SnapshotRouterOptions {
  /** Monotonic milliseconds. Useful for deterministic deadline tests. */
  clock?: () => number;
  /** Keeps a smaller caller budget in force throughout the scan. */
  checkTime?: () => void;
  /** Optional caller-owned counters that remain available if a shard read fails. */
  diagnostics?: SnapshotRouterResult['diagnostics'];
}

/** Route against the captured version, loading only the next relevant connection bucket(s). */
export async function routeTransitSnapshot(snapshot: LoadedSnapshot, input: RouterQuery,
  { clock = () => performance.now(), checkTime: checkRequestTime,
    diagnostics = { connectionBuckets: 0, connectionShards: 0, transferShards: 0 } }: SnapshotRouterOptions = {}
): Promise<SnapshotRouterResult> {
  const limits = routerLimits(input.limits);
  const wallTimeMs = limits.wallTimeMs;
  const deadline = wallTimeMs === null ? null : clock() + wallTimeMs;
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const checkTime = () => {
    checkRequestTime?.();
    if (expired || (deadline !== null && clock() >= deadline)) throw new BudgetExceeded('timeout');
  };

  async function run(): Promise<RouterResult> {
    checkTime();
    const scan = new ConnectionScan(input, limits);
    if (!scan.hasEndpoints) return scan.result();
    const buckets = selectBuckets(snapshot.manifest, scan.departureEpochMs, scan.endEpochMs, checkTime);
    const previousByTrip = new Map<string, TransitConnection>();
    const connectionReadPaths = new Set<string>();
    const loadedTransferCells = new Set<string>();
    const transferReadPaths = new Set<string>();
    const readTransfers = createTransferCandidateLoader(snapshot, (path) => {
      checkTime();
      if (transferReadPaths.has(path)) return;
      if (limits.maxTransferShards !== null && transferReadPaths.size >= limits.maxTransferShards) {
        throw new BudgetExceeded('transfer-shards');
      }
      transferReadPaths.add(path);
      diagnostics.transferShards = transferReadPaths.size;
    });
    let stopsByGridPath: Map<string, string[]> | undefined;
    let cellsByGridPath: Map<string, string> | undefined;

    interface BucketCursor {
      iterator: AsyncIterator<ConnectionInstance>;
      current: ConnectionInstance;
    }

    const active: BucketCursor[] = [];

    async function loadTransfers(gridPath: string) {
      if (!stopsByGridPath) {
        stopsByGridPath = new Map<string, string[]>();
        cellsByGridPath = new Map(Object.entries(snapshot.manifest.indexes.stopGrid).map(([cell, path]) => [path, cell]));
        for (const [id, path] of Object.entries(snapshot.manifest.indexes.stops)) {
          checkTime();
          const ids = stopsByGridPath.get(path) ?? [];
          ids.push(id);
          stopsByGridPath.set(path, ids);
        }
      }
      checkTime();
      // Load a bounded 5x5 neighborhood as one concurrent batch. Transfer edges never
      // leave the inner 3x3 area; the outer ring is safe read-ahead for later labels.
      const [latitude, longitude] = cellsByGridPath!.get(gridPath)!.split('_').map(Number);
      const paths: string[] = [];
      for (let latitudeOffset = -2; latitudeOffset <= 2; latitudeOffset++) {
        for (let longitudeOffset = -2; longitudeOffset <= 2; longitudeOffset++) {
          const cell = `${latitude + latitudeOffset}_${longitude + longitudeOffset}`;
          const path = snapshot.manifest.indexes.stopGrid[cell];
          if (path && !loadedTransferCells.has(path)) paths.push(path);
        }
      }
      for (const path of paths) loadedTransferCells.add(path);
      const transfers = await readTransfers(paths.flatMap((path) => stopsByGridPath!.get(path)!));
      checkTime();
      scan.addTransfers(transfers);
    }

    function validateTripContinuity(instance: ConnectionInstance) {
      const record = instance.connection;
      const key = tripKey(instance.serviceDate, record.tripId);
      const previous = previousByTrip.get(key);
      if (previous && (previous.arrival > record.departure
        || previous.arrivalStopSequence !== record.stopSequence
        || previous.toStopId !== record.fromStopId || !sameVehicle(previous, record))) {
        throw new TransitSnapshotError('INVALID_SHARD');
      }
      previousByTrip.set(key, record);
    }

    async function advanceCursor(cursor: BucketCursor) {
      const next = await cursor.iterator.next();
      checkTime();
      if (next.done) active.splice(active.indexOf(cursor), 1);
      else cursor.current = next.value;
    }

    async function drainBefore(exclusiveEnd: number, routeConnections: boolean) {
      while (true) {
        checkTime();
        let cursor: BucketCursor | undefined;
        for (const candidate of active) {
          if (candidate.current.departureEpochMs >= exclusiveEnd) continue;
          if (!cursor || compareConnections(candidate.current, cursor.current) < 0) cursor = candidate;
        }
        if (!cursor) return;

        const instance = cursor.current;
        validateTripContinuity(instance);
        if (routeConnections && instance.departureEpochMs >= scan.departureEpochMs
          && instance.departureEpochMs <= scan.endEpochMs && scan.canImprove(instance.departureEpochMs)) {
          const alighted = scan.advance(instance);
          const expandable = alighted.filter((label) => scan.alight(label));
          if (expandable.length > 0 && instance.arrivalEpochMs < scan.endEpochMs
            && scan.canImprove(instance.arrivalEpochMs)) {
            const gridPath = snapshot.manifest.indexes.stops[instance.connection.toStopId];
            if (!loadedTransferCells.has(gridPath)) await loadTransfers(gridPath);
            for (const label of expandable) scan.expandTransfers(label);
          }
        }
        await advanceCursor(cursor);
      }
    }

    // Historical offsets can shift one dated bucket across another bucket's boundary.
    // Open equal-start buckets together, then merge their streams in absolute time order.
    let index = 0;
    while (index < buckets.length) {
      checkTime();
      const groupStart = buckets[index].startEpochMs;
      if (!scan.canImprove(groupStart)) {
        // The old materializing reader had already validated every opened shard. Preserve
        // that fail-closed behavior while avoiding route work that cannot improve a result.
        await drainBefore(Infinity, false);
        break;
      }

      while (index < buckets.length && buckets[index].startEpochMs === groupStart) {
        if (diagnostics.connectionBuckets >= limits.maxBuckets) throw new BudgetExceeded('buckets');
        const bucket = buckets[index++];
        diagnostics.connectionBuckets++;
        if (!connectionReadPaths.has(bucket.path)) {
          connectionReadPaths.add(bucket.path);
          diagnostics.connectionShards = connectionReadPaths.size;
        }
        const iterator = streamBucket(snapshot, bucket, snapshot.manifest, checkTime)[Symbol.asyncIterator]();
        const first = await iterator.next();
        checkTime();
        if (first.done) throw new TransitSnapshotError('INVALID_SHARD');
        active.push({ iterator, current: first.value });
      }

      const nextStart = buckets[index]?.startEpochMs ?? Infinity;
      await drainBefore(nextStart, true);
    }

    if (index >= buckets.length) await drainBefore(Infinity, true);
    const result = scan.result();
    checkTime();
    return result;
  }

  try {
    if (wallTimeMs === null) return { ...await run(), diagnostics };
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        reject(new BudgetExceeded('timeout'));
      }, wallTimeMs);
    });
    return { ...await Promise.race([run(), timeout]), diagnostics };
  } catch (error) {
    if (expired || (deadline !== null && clock() >= deadline)) {
      return { status: 'budget-exceeded', budget: 'timeout', diagnostics };
    }
    return { ...budgetResult(error), diagnostics };
  } finally {
    clearTimeout(timer);
  }
}

interface TopologyEdge {
  connection: TransitConnection;
  durationSeconds: number;
}

interface TransitTopology {
  outgoing: ReadonlyMap<string, readonly TopologyEdge[]>;
  representatives: ReadonlyMap<string, TransitConnection>;
  transfers: ReadonlyMap<string, readonly TransitTransfer[]>;
}

interface TopologyRideTransition {
  kind: 'ride';
  previous: TopologyState;
  edge: TopologyEdge;
  departureSeconds: number;
  arrivalSeconds: number;
}

interface TopologyTransferTransition {
  kind: 'transfer';
  previous: TopologyState;
  transfer: TransitTransfer;
  departureSeconds: number;
  arrivalSeconds: number;
}

type TopologyTransition = TopologyRideTransition | TopologyTransferTransition;

interface TopologyState {
  key: string;
  stopId: string;
  patternId: string | null;
  sequence: number;
  canAlight: boolean;
  changeBuffered: boolean;
  boardings: number;
  elapsedSeconds: number;
  walkingSeconds: number;
  access: StopWalk;
  transition: TopologyTransition | null;
}

interface TopologyDestination {
  state: TopologyState;
  egress: StopWalk;
}

const topologyCache = new Map<string, Promise<TransitTopology>>();

function compareTopologyMetrics(first: Pick<TopologyState, 'elapsedSeconds' | 'walkingSeconds' | 'boardings' | 'key'>,
  second: Pick<TopologyState, 'elapsedSeconds' | 'walkingSeconds' | 'boardings' | 'key'>,
  preference: RoutePreference): number {
  const time = first.elapsedSeconds - second.elapsedSeconds;
  const walking = first.walkingSeconds - second.walkingSeconds;
  const boardings = first.boardings - second.boardings;
  const metric = preference === 'less-walking' ? walking || time || boardings
    : preference === 'fewer-transfers' ? boardings || time || walking
      : time || walking || boardings;
  return metric || compareIds(first.key, second.key);
}

class TopologyQueue {
  private readonly values: TopologyState[] = [];
  private readonly compare: (first: TopologyState, second: TopologyState) => number;

  constructor(compare: (first: TopologyState, second: TopologyState) => number) {
    this.compare = compare;
  }

  get size(): number { return this.values.length; }

  push(value: TopologyState): void {
    let index = this.values.push(value) - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.values[parent], value) <= 0) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop(): TopologyState | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.values.length) break;
      const right = left + 1;
      const child = right < this.values.length && this.compare(this.values[right], this.values[left]) < 0 ? right : left;
      if (this.compare(last, this.values[child]) <= 0) break;
      this.values[index] = this.values[child];
      index = child;
    }
    this.values[index] = last;
    return first;
  }
}

function topologyStateKey(stopId: string, patternId: string | null, sequence: number, boardings: number): string {
  return `${stopId}\0${patternId ?? ''}\0${sequence}\0${boardings}`;
}

async function loadTransitTopology(snapshot: LoadedSnapshot, buckets: readonly Bucket[], checkTime: () => void,
  diagnostics: SnapshotRouterResult['diagnostics']): Promise<TransitTopology> {
  const key = JSON.stringify([snapshot.pointer.manifestSha256, ...buckets.map(({ path }) => path)]);
  if (snapshot.manifest.schemaVersion === 2) diagnostics.transferGraphLoaded = true;
  const cached = topologyCache.get(key);
  if (cached) return cached;

  const loading = (async () => {
    const outgoing = new Map<string, Map<string, TopologyEdge>>();
    const representatives = new Map<string, TransitConnection>();
    const transferEdges = await loadSnapshotTransferGraph(snapshot);
    checkTime();
    const transfers = new Map<string, TransitTransfer[]>();
    for (const transfer of transferEdges) {
      const edges = transfers.get(transfer.fromStopId) ?? [];
      edges.push(transfer);
      transfers.set(transfer.fromStopId, edges);
    }
    for (const edges of transfers.values()) edges.sort((first, second) => compareIds(first.toStopId, second.toStopId));
    const paths = new Set<string>();
    for (const bucket of buckets) {
      checkTime();
      diagnostics.connectionBuckets++;
      paths.add(bucket.path);
      diagnostics.connectionShards = paths.size;
      for await (const instance of streamBucket(snapshot, bucket, snapshot.manifest, checkTime)) {
        const connection = instance.connection;
        const representative = representatives.get(connection.patternId);
        if (!representative || compareIds(connection.tripId, representative.tripId) < 0) {
          representatives.set(connection.patternId, connection);
        }
        const durationSeconds = Math.max(1, connection.arrival - connection.departure);
        const edges = outgoing.get(connection.fromStopId) ?? new Map<string, TopologyEdge>();
        const edgeKey = `${connection.patternId}\0${connection.stopSequence}\0${connection.arrivalStopSequence}\0${connection.toStopId}`;
        const previous = edges.get(edgeKey);
        if (!previous || durationSeconds < previous.durationSeconds
          || (durationSeconds === previous.durationSeconds && compareIds(connection.tripId, previous.connection.tripId) < 0)) {
          edges.set(edgeKey, { connection, durationSeconds });
        }
        outgoing.set(connection.fromStopId, edges);
      }
    }
    const sorted = new Map<string, readonly TopologyEdge[]>();
    for (const [stopId, edges] of outgoing) {
      sorted.set(stopId, [...edges.values()].sort((first, second) =>
        compareIds(first.connection.patternId, second.connection.patternId)
        || first.connection.stopSequence - second.connection.stopSequence
        || first.connection.arrivalStopSequence - second.connection.arrivalStopSequence
        || compareIds(first.connection.toStopId, second.connection.toStopId)));
    }
    return { outgoing: sorted, representatives, transfers };
  })();
  topologyCache.set(key, loading);
  while (topologyCache.size > 2) topologyCache.delete(topologyCache.keys().next().value!);
  try {
    return await loading;
  } catch (error) {
    if (topologyCache.get(key) === loading) topologyCache.delete(key);
    throw error;
  }
}

function topologyJourney(destination: TopologyDestination, input: RouterQuery,
  representatives: TransitTopology['representatives'], serviceDate: string): JourneySegment[] {
  const transitions: TopologyTransition[] = [];
  for (let state: TopologyState | null = destination.state; state?.transition; state = state.transition.previous) {
    transitions.push(state.transition);
  }
  transitions.reverse();
  const start = input.departureAt.getTime();
  const accessArrival = start + destination.state.access.walkingSeconds * 1000;
  const journey: JourneySegment[] = [{
    kind: 'walk', role: 'access', fromCoordinate: input.origin, toStopId: destination.state.access.stopId,
    departureEpochMs: start, arrivalEpochMs: accessArrival, distanceMeters: destination.state.access.distanceMeters,
    walkingSeconds: destination.state.access.walkingSeconds,
  }];
  for (const transition of transitions) {
    if (transition.kind === 'transfer') {
      const transfer = transition.transfer;
      journey.push({
        kind: 'walk', role: 'transfer', fromStopId: transfer.fromStopId, toStopId: transfer.toStopId,
        departureEpochMs: start + transition.departureSeconds * 1000,
        arrivalEpochMs: start + transition.arrivalSeconds * 1000,
        distanceMeters: transfer.distanceMeters, walkingSeconds: estimateWalk(transfer.distanceMeters).walkingSeconds,
        evidence: transfer.evidence,
      });
      continue;
    }
    const edge = transition.edge.connection;
    const vehicle = representatives.get(edge.patternId) ?? edge;
    journey.push({
      kind: 'ride', serviceDate, tripId: vehicle.tripId, routeId: vehicle.routeId, serviceId: vehicle.serviceId,
      patternId: edge.patternId, shapeId: vehicle.shapeId, directionId: vehicle.directionId, headsign: vehicle.headsign,
      fromStopId: edge.fromStopId, toStopId: edge.toStopId, stopIds: [edge.fromStopId, edge.toStopId],
      stopSequence: edge.stopSequence, arrivalStopSequence: edge.arrivalStopSequence,
      departureEpochMs: start + transition.departureSeconds * 1000,
      arrivalEpochMs: start + transition.arrivalSeconds * 1000,
    });
  }
  const rideArrival = start + destination.state.elapsedSeconds * 1000;
  journey.push({
    kind: 'walk', role: 'egress', fromStopId: destination.state.stopId, toCoordinate: input.destination,
    departureEpochMs: rideArrival,
    arrivalEpochMs: rideArrival + destination.egress.walkingSeconds * 1000,
    distanceMeters: destination.egress.distanceMeters, walkingSeconds: destination.egress.walkingSeconds,
  });
  return journey;
}

/** Route over one representative daytime bucket; departure schedules intentionally do not affect path selection. */
export async function routeTransitTopology(snapshot: LoadedSnapshot, input: RouterQuery,
  { clock = () => performance.now(), checkTime: checkRequestTime,
    diagnostics = { connectionBuckets: 0, connectionShards: 0, transferShards: 0 } }: SnapshotRouterOptions = {}
): Promise<SnapshotRouterResult> {
  const limits = routerLimits(input.limits);
  const deadline = limits.wallTimeMs === null ? null : clock() + limits.wallTimeMs;
  const checkTime = () => {
    checkRequestTime?.();
    if (deadline !== null && clock() >= deadline) throw new BudgetExceeded('timeout');
  };
  try {
    const buckets = selectTopologyBuckets(snapshot.manifest, input.departureAt, limits, checkTime);
    if (buckets.length === 0 || input.access.length === 0 || input.egress.length === 0) {
      return { status: 'no-route', diagnostics };
    }
    const topology = await loadTransitTopology(snapshot, buckets, checkTime, diagnostics);
    checkTime();
    const preference = input.preference ?? 'fastest';
    const allowedModes = input.allowedModes ?? new Set<VehicleMode>(allTransitModes);
    const compare = (first: TopologyState, second: TopologyState) => compareTopologyMetrics(first, second, preference);
    const queue = new TopologyQueue(compare);
    const best = new Map<string, TopologyState>();
    const destinations = new Map(input.egress.map((walk) => [walk.stopId, walk]));
    let choice: TopologyDestination | null = null;

    for (const access of input.access) {
      assertStopWalk(access);
      const key = topologyStateKey(access.stopId, null, -1, 0);
      const state: TopologyState = {
        key, stopId: access.stopId, patternId: null, sequence: -1, canAlight: true, changeBuffered: false, boardings: 0,
        elapsedSeconds: access.walkingSeconds, walkingSeconds: access.walkingSeconds, access, transition: null,
      };
      const previous = best.get(key);
      if (!previous || compare(state, previous) < 0) {
        best.set(key, state);
        queue.push(state);
      }
    }

    while (queue.size > 0) {
      checkTime();
      const state = queue.pop()!;
      if (best.get(state.key) !== state) continue;
      const egress = destinations.get(state.stopId);
      if (egress && state.boardings > 0 && state.canAlight) {
        const candidate = { state: { ...state, elapsedSeconds: state.elapsedSeconds + egress.walkingSeconds,
          walkingSeconds: state.walkingSeconds + egress.walkingSeconds }, egress };
        if (!choice || compare(candidate.state, {
          ...choice.state, elapsedSeconds: choice.state.elapsedSeconds + choice.egress.walkingSeconds,
          walkingSeconds: choice.state.walkingSeconds + choice.egress.walkingSeconds,
        }) < 0) choice = { state, egress };
      }

      if (state.canAlight) {
        for (const transfer of topology.transfers.get(state.stopId) ?? []) {
          const elapsedSeconds = state.elapsedSeconds + transfer.seconds;
          if (elapsedSeconds > limits.horizonSeconds) continue;
          const key = topologyStateKey(transfer.toStopId, null, -1, state.boardings);
          const next: TopologyState = {
            key, stopId: transfer.toStopId, patternId: null, sequence: -1, canAlight: true, changeBuffered: true,
            boardings: state.boardings, elapsedSeconds,
            walkingSeconds: state.walkingSeconds + estimateWalk(transfer.distanceMeters).walkingSeconds,
            access: state.access,
            transition: { kind: 'transfer', previous: state, transfer,
              departureSeconds: state.elapsedSeconds, arrivalSeconds: elapsedSeconds },
          };
          const previous = best.get(key);
          if (previous && compare(previous, next) <= 0) continue;
          best.set(key, next);
          if (best.size > limits.maxTotalLabels) throw new BudgetExceeded('total-labels');
          queue.push(next);
        }
      }

      for (const edge of topology.outgoing.get(state.stopId) ?? []) {
        const connection = edge.connection;
        if (!allowedModes.has(connection.mode ?? 'bus')) continue;
        const continuing = state.patternId === connection.patternId && state.sequence === connection.stopSequence;
        if (!continuing && ((!state.canAlight && state.patternId !== null) || connection.pickupType !== 0)) continue;
        const boardings = state.boardings + (continuing ? 0 : 1);
        if (boardings > limits.maxBoardings) continue;
        const wait = continuing ? 0 : state.boardings === 0 ? boardingBufferSeconds
          : state.changeBuffered ? 0 : transferBufferSeconds;
        const departureSeconds = state.elapsedSeconds + wait;
        const elapsedSeconds = departureSeconds + edge.durationSeconds;
        if (elapsedSeconds > limits.horizonSeconds) continue;
        const key = topologyStateKey(connection.toStopId, connection.patternId,
          connection.arrivalStopSequence, boardings);
        const next: TopologyState = {
          key, stopId: connection.toStopId, patternId: connection.patternId,
          sequence: connection.arrivalStopSequence, canAlight: connection.dropOffType === 0,
          changeBuffered: false,
          boardings, elapsedSeconds, walkingSeconds: state.walkingSeconds, access: state.access,
          transition: { kind: 'ride', previous: state, edge, departureSeconds, arrivalSeconds: elapsedSeconds },
        };
        const previous = best.get(key);
        if (previous && compare(previous, next) <= 0) continue;
        best.set(key, next);
        if (best.size > limits.maxTotalLabels) throw new BudgetExceeded('total-labels');
        queue.push(next);
      }
    }

    if (!choice) return { status: 'no-route', diagnostics };
    const serviceDate = buckets[0].day.serviceDate;
    return { status: 'ok', journeys: [topologyJourney(choice, input, topology.representatives, serviceDate)], diagnostics };
  } catch (error) {
    return { ...budgetResult(error), diagnostics };
  }
}
