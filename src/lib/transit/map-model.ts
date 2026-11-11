import type { Coordinate, TransitBoardingPoint, TransitItinerary, TransitLeg, TransitMode } from './contracts.ts';
import { getCanonicalStopHref, getModePresentation } from './presentation.ts';

type MarkerRole = TransitBoardingPoint['role'];

export interface TransitMapSegment {
  mode: TransitMode;
  coordinates: Coordinate[];
  color: string;
  dashed: boolean;
  highlighted: boolean;
}

export interface TransitMapPoint {
  role: MarkerRole;
  name: string;
  code?: string;
  action: string;
  time?: string;
  mode?: TransitMode;
  lineCode?: string;
  href?: string;
}

export interface TransitMapMarker {
  coordinate: Coordinate;
  points: TransitMapPoint[];
  highlighted: boolean;
}

export interface TransitMapModel {
  segments: TransitMapSegment[];
  markers: TransitMapMarker[];
  bounds: [southWest: Coordinate, northEast: Coordinate] | null;
  hasApproximateGeometry: boolean;
}

const markerActions: Record<MarkerRole, string> = {
  origin: 'Başlangıç',
  board: 'Biniş',
  alight: 'İniş',
  transfer: 'Aktarma',
  destination: 'Varış',
};

type MarkerDetails = Pick<TransitMapPoint, 'time' | 'mode' | 'lineCode'>;
type StepEvent = {
  role: 'board' | 'alight' | 'transfer';
  coordinate: Coordinate;
  stopId?: string;
  name?: string;
  details: MarkerDetails;
};

function getStepEvents({ steps }: TransitItinerary): StepEvent[] {
  return steps.flatMap<StepEvent>((step, index) => {
    const next = steps[index + 1];
    if (step.kind === 'walk') {
      const end = step.geometry.at(-1);
      return end && index > 0 && next?.kind === 'walk'
        ? [{ role: 'transfer', coordinate: end, details: { time: step.arrivalTime, mode: step.mode } }]
        : [];
    }

    const { board, alight, mode, lineCode } = step;
    const isTransfer = next?.kind === 'ride' && alight.stopId !== undefined && next.board.stopId === alight.stopId;
    return [
      { ...board, role: 'board', details: { time: step.departureTime, mode, lineCode } },
      { ...alight, role: isTransfer ? 'transfer' : 'alight', details: { time: step.arrivalTime, mode, lineCode } },
    ];
  });
}

function matchesEvent(point: TransitBoardingPoint, event: StepEvent): boolean {
  if (point.role !== event.role) return false;
  if (point.stopId !== undefined && event.stopId !== undefined) return point.stopId === event.stopId;
  return (event.name === undefined || event.name === point.name)
    && point.coordinate[0] === event.coordinate[0] && point.coordinate[1] === event.coordinate[1];
}

function buildPoints(itinerary: TransitItinerary): (TransitMapPoint & { coordinate: Coordinate })[] {
  const events = getStepEvents(itinerary);
  let nextEvent = 0;
  return itinerary.keyPoints.map((point) => {
    const { role, name, coordinate, code } = point;
    const href = getCanonicalStopHref(point.contentLink?.canonicalUrl);
    const marker = { role, name, coordinate, code, action: markerActions[role], ...(href ? { href } : {}) };

    if (role === 'origin') return { ...marker, time: itinerary.departureTime, mode: itinerary.steps[0]?.mode };
    if (role === 'destination') return { ...marker, time: itinerary.arrivalTime, mode: itinerary.steps.at(-1)?.mode };

    // Consume events in journey order so a repeated stop uses the time for that visit.
    const index = events.findIndex((event, index) => index >= nextEvent && matchesEvent(point, event));
    if (index === -1) return marker;
    nextEvent = index + 1;
    return { ...marker, ...events[index].details };
  });
}

function coordinateKey(coordinate: Coordinate): string {
  return coordinate.join(',');
}

function buildMarkers(itinerary: TransitItinerary, endpoints: Coordinate[]): TransitMapMarker[] {
  const markers = new Map<string, TransitMapMarker>();
  const highlighted = new Set(endpoints.map(coordinateKey));
  for (const { coordinate, ...point } of buildPoints(itinerary)) {
    const key = coordinateKey(coordinate);
    const marker = markers.get(key);
    if (marker) marker.points.push(point);
    else markers.set(key, { coordinate, points: [point], highlighted: highlighted.has(key) });
  }
  return [...markers.values()];
}

function stepEndpoints(step: TransitLeg | undefined): Coordinate[] {
  if (!step) return [];
  if (step.kind === 'ride') return [step.board.coordinate, step.alight.coordinate];
  const start = step.geometry[0];
  const end = step.geometry.at(-1);
  return start && end ? [start, end] : [];
}

function getBounds(segments: TransitMapSegment[], points: Coordinate[]): TransitMapModel['bounds'] {
  let bounds: TransitMapModel['bounds'] = null;
  function extend([latitude, longitude]: Coordinate) {
    if (bounds === null) {
      bounds = [[latitude, longitude], [latitude, longitude]];
      return;
    }
    const [southWest, northEast] = bounds;
    southWest[0] = Math.min(southWest[0], latitude);
    southWest[1] = Math.min(southWest[1], longitude);
    northEast[0] = Math.max(northEast[0], latitude);
    northEast[1] = Math.max(northEast[1], longitude);
  }
  for (const segment of segments) segment.coordinates.forEach(extend);
  points.forEach(extend);
  return bounds;
}

export function buildTransitMapModel(itinerary: TransitItinerary, selectedStep: number | null = null): TransitMapModel {
  const segments = itinerary.steps.map(({ mode, geometry, geometryQuality }, index) => ({
    mode,
    coordinates: geometry,
    color: getModePresentation(mode).color,
    dashed: geometryQuality === 'approximate',
    highlighted: index === selectedStep,
  }));
  const activeSegment = selectedStep === null ? undefined : segments[selectedStep];
  const endpoints = selectedStep === null ? [] : stepEndpoints(itinerary.steps[selectedStep]);
  const markers = buildMarkers(itinerary, endpoints);
  const focusedBounds = activeSegment ? getBounds([activeSegment], endpoints) : null;
  return {
    segments,
    markers,
    bounds: focusedBounds ?? getBounds(segments, markers.map(({ coordinate }) => coordinate)),
    hasApproximateGeometry: segments.some(({ dashed }) => dashed),
  };
}
