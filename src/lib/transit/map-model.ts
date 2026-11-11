import type { Coordinate, TransitBoardingPoint, TransitItinerary, TransitMode } from './contracts.ts';
import { getCanonicalStopHref, getModePresentation } from './presentation.ts';

type MarkerRole = TransitBoardingPoint['role'];

export interface TransitMapSegment {
  mode: TransitMode;
  coordinates: Coordinate[];
  color: string;
  dashed: boolean;
}

export interface TransitMapMarker {
  role: MarkerRole;
  coordinate: Coordinate;
  name: string;
  code?: string;
  action: string;
  time?: string;
  mode?: TransitMode;
  lineCode?: string;
  href?: string;
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

type MarkerDetails = Pick<TransitMapMarker, 'time' | 'mode' | 'lineCode'>;
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

function buildMarkers(itinerary: TransitItinerary): TransitMapMarker[] {
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

function getBounds(segments: TransitMapSegment[], markers: TransitMapMarker[]): TransitMapModel['bounds'] {
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
  for (const marker of markers) extend(marker.coordinate);
  return bounds;
}

export function buildTransitMapModel(itinerary: TransitItinerary): TransitMapModel {
  const segments = itinerary.steps.map(({ mode, geometry, geometryQuality }) => ({
    mode,
    coordinates: geometry,
    color: getModePresentation(mode).color,
    dashed: geometryQuality === 'approximate',
  }));
  const markers = buildMarkers(itinerary);
  return {
    segments,
    markers,
    bounds: getBounds(segments, markers),
    hasApproximateGeometry: segments.some(({ dashed }) => dashed),
  };
}
