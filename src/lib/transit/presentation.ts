import { BROKEN_DURAK_SLUGS } from '../../broken-redirects.ts';
import type { RoutePreference, TransitBoardingPoint, TransitItinerary, TransitMode } from './contracts.ts';
import { coordinatesInRouteSearchArea } from './route-search-area.ts';
import type { PlannerLocation, ShareablePlannerState } from './share-url.ts';

const modes = {
  walking: { label: 'Yürüme', color: '#6b7280', icon: 'footprints' },
  bus: { label: 'Otobüs', color: '#f59e0b', icon: 'bus' },
  metro: { label: 'Metro', color: '#dc2626', icon: 'train-front' },
  tram: { label: 'Tramvay', color: '#e11d48', icon: 'tram-front' },
  rail: { label: 'Tren', color: '#881337', icon: 'train-track' },
  ferry: { label: 'Vapur', color: '#2563eb', icon: 'ship' },
  funicular: { label: 'Füniküler', color: '#be123c', icon: 'cable-car' },
  minibus: { label: 'Minibüs', color: '#7c3aed', icon: 'van' },
} as const satisfies Record<TransitMode, { label: string; color: string; icon: string }>;

export type ModePresentation = (typeof modes)[TransitMode];

type RideMode = Exclude<TransitMode, 'walking'>;
export type TimelineStop = { name: string; href?: string };

export type TimelineItem = { stepIndex: number; time: string } & (
  | { kind: 'walk'; mode: 'walking'; durationMinutes: number; instruction: string }
  | { kind: 'board'; mode: RideMode; lineCode: string; vehicle: string; stop: TimelineStop; action: string; stopCountLabel: string }
  | { kind: 'alight'; mode: RideMode; stop: TimelineStop; action: string }
);

const boardingVehicles: Record<RideMode, string> = {
  bus: 'otobüsüne',
  metro: 'metrosuna',
  tram: 'tramvayına',
  rail: 'trenine',
  ferry: 'vapuruna',
  funicular: 'fünikülerine',
  minibus: 'minibüsüne',
};

const siteOrigin = 'https://hizliulasim.com';
const canonicalStopPath = /^\/otobus-duraklari\/([a-z0-9]+(?:-[a-z0-9]+)*-[0-9]+)$/;

export function getModePresentation(mode: TransitMode): ModePresentation {
  return modes[mode];
}

export function getCanonicalStopHref(href: string | undefined): string | undefined {
  if (typeof href !== 'string' || href.trim() !== href) return undefined;

  const path = href.startsWith(`${siteOrigin}/`) ? href.slice(siteOrigin.length) : href;
  const match = canonicalStopPath.exec(path);
  return match && !BROKEN_DURAK_SLUGS.has(match[1]) ? href : undefined;
}

function getStopLabel(point: TransitBoardingPoint): TimelineStop {
  const href = getCanonicalStopHref(point.contentLink?.canonicalUrl);
  return href ? { name: point.name, href } : { name: point.name };
}

export function buildTimelineItems(itinerary: TransitItinerary): TimelineItem[] {
  return itinerary.steps.flatMap<TimelineItem>((step, stepIndex) => {
    if (step.kind === 'walk') {
      return {
        kind: 'walk', mode: step.mode, stepIndex, durationMinutes: step.durationMinutes,
        time: step.departureTime, instruction: `${step.durationMinutes} dk yürü`,
      };
    }

    return [
      {
        kind: 'board', mode: step.mode, stepIndex, lineCode: step.lineCode, stop: getStopLabel(step.board),
        vehicle: boardingVehicles[step.mode], action: 'durağında bin', time: step.departureTime,
        stopCountLabel: `${step.stopCount} durak`,
      },
      {
        kind: 'alight', mode: step.mode, stepIndex, stop: getStopLabel(step.alight),
        action: 'durağında in', time: step.arrivalTime,
      },
    ];
  });
}

export function getItinerarySummary(itinerary: TransitItinerary) {
  const { durationMinutes, walkingMinutes, transferCount, departureTime, arrivalTime } = itinerary;
  return {
    duration: `${durationMinutes} dk`,
    walking: `${walkingMinutes} dk yürüme`,
    transfers: transferCount === 0 ? 'Aktarmasız' : `${transferCount} aktarma`,
    departureTime,
    arrivalTime,
  };
}

export type PlannerEndpointRole = 'origin' | 'destination';

export interface PlannerPrediction {
  id: string;
  description: string;
}

type PendingLookup =
  | { kind: 'search'; id: number; query: string }
  | { kind: 'details'; id: number; prediction: PlannerPrediction }
  | { kind: 'geolocation'; id: number };

export type PlannerLookup =
  | PendingLookup
  | { kind: 'idle' }
  | { kind: 'suggestions'; predictions: PlannerPrediction[] }
  | { kind: 'error'; message: string };

export interface PlannerEndpoint {
  value: PlannerLocation | null;
  query: string;
  lookup: PlannerLookup;
}

export type PlannerRoute =
  | { kind: 'idle' }
  | ({ kind: 'loading'; id: number } & Omit<ShareablePlannerState, 'selectedAlternative'>)
  | { kind: 'success'; departureAt: string; alternatives: TransitItinerary[]; selectedAlternative: number }
  | { kind: 'error'; message: string };

export interface PlannerState {
  origin: PlannerEndpoint;
  destination: PlannerEndpoint;
  destinationLocked: boolean;
  departureAt: string;
  preference: RoutePreference;
  requestedAlternative: number;
  route: PlannerRoute;
  serial: number;
}

export type PlannerAction =
  | ({ role: PlannerEndpointRole } & (
    | { type: 'edit-location'; query: string }
    | { type: 'suggestions'; id: number; predictions: PlannerPrediction[] }
    | { type: 'choose-place'; placeId: string }
    | { type: 'locate' }
    | { type: 'resolve-location'; id: number; value: PlannerLocation }
    | { type: 'lookup-failed'; id: number; message: string }
  ))
  | { type: 'swap-locations' }
  | { type: 'set-departure'; departureAt: string }
  | { type: 'set-preference'; preference: RoutePreference }
  | { type: 'route-succeeded'; id: number; departureAt: string; alternatives: TransitItinerary[] }
  | { type: 'route-failed'; id: number; message: string }
  | { type: 'cancel-route' }
  | { type: 'retry-route' }
  | { type: 'select-alternative'; index: number };

export function isPlannerLocation(value: PlannerLocation | undefined): boolean {
  return !!value && coordinatesInRouteSearchArea(value.latitude, value.longitude);
}

function selectedEndpoint(location?: PlannerLocation): PlannerEndpoint {
  if (!location) return { value: null, query: '', lookup: { kind: 'idle' } };
  if (isPlannerLocation(location)) return { value: location, query: location.name, lookup: { kind: 'idle' } };

  const message = Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? 'Bu konum rota arama alanının dışında. İstanbul ve çevresinde bir yer seçin.'
    : 'Konumun koordinatları alınamadı. Yer aramasını kullanabilirsiniz.';
  return { value: null, query: location.name, lookup: { kind: 'error', message } };
}

function calculateRoute(state: PlannerState): PlannerState {
  const { origin, destination, departureAt, preference } = state;
  if (!origin.value || !destination.value) return { ...state, route: { kind: 'idle' } };
  const id = state.serial + 1;
  return {
    ...state,
    serial: id,
    route: { kind: 'loading', id, origin: origin.value, destination: destination.value, departureAt, preference },
  };
}

function recalculateRoute(state: PlannerState): PlannerState {
  return calculateRoute({ ...state, requestedAlternative: 0 });
}

export function createPlannerState(
  initialState: Partial<ShareablePlannerState> = {},
  fixedDestination?: PlannerLocation,
): PlannerState {
  return calculateRoute({
    origin: selectedEndpoint(initialState.origin),
    destination: selectedEndpoint(fixedDestination ?? initialState.destination),
    destinationLocked: fixedDestination !== undefined,
    departureAt: initialState.departureAt ?? '',
    preference: initialState.preference ?? 'fastest',
    requestedAlternative: initialState.selectedAlternative ?? 0,
    route: { kind: 'idle' },
    serial: 0,
  });
}

function replaceEndpoint(
  state: PlannerState, role: PlannerEndpointRole, endpoint: PlannerEndpoint,
): PlannerState {
  const next = { ...state, [role]: endpoint };
  return state[role].value === endpoint.value ? next : recalculateRoute(next);
}

function reduceLocation(state: PlannerState, action: Extract<PlannerAction, { role: PlannerEndpointRole }>): PlannerState {
  const { role } = action;
  if (role === 'destination' && state.destinationLocked) return state;
  const endpoint = state[role];
  const { lookup } = endpoint;
  const id = state.serial + 1;

  switch (action.type) {
    case 'edit-location': {
      const query = action.query.trim();
      if (query.length < 2) {
        return replaceEndpoint(state, role, { value: null, query: action.query, lookup: { kind: 'idle' } });
      }
      return replaceEndpoint({ ...state, serial: id }, role, {
        value: null, query: action.query, lookup: { kind: 'search', id, query },
      });
    }
    case 'suggestions':
      if (lookup.kind !== 'search' || lookup.id !== action.id) return state;
      return replaceEndpoint(state, role, { ...endpoint, lookup: { kind: 'suggestions', predictions: action.predictions } });
    case 'choose-place': {
      if (lookup.kind !== 'suggestions') return state;
      const prediction = lookup.predictions.find((item) => item.id === action.placeId);
      if (!prediction) return state;
      return replaceEndpoint({ ...state, serial: id }, role, {
        value: null, query: prediction.description, lookup: { kind: 'details', id, prediction },
      });
    }
    case 'locate':
      return replaceEndpoint({ ...state, serial: id }, role, {
        value: null, query: endpoint.value ? '' : endpoint.query, lookup: { kind: 'geolocation', id },
      });
    case 'resolve-location': {
      if ((lookup.kind !== 'details' && lookup.kind !== 'geolocation') || lookup.id !== action.id) return state;
      const selection = selectedEndpoint(action.value);
      return replaceEndpoint(state, role, selection.value ? selection : { ...endpoint, lookup: selection.lookup });
    }
    case 'lookup-failed':
      if (!('id' in lookup) || lookup.id !== action.id) return state;
      return replaceEndpoint(state, role, { ...endpoint, lookup: { kind: 'error', message: action.message } });
  }
}

export function reducePlanner(state: PlannerState, action: PlannerAction): PlannerState {
  if ('role' in action) return reduceLocation(state, action);
  const { origin, destination, route } = state;

  switch (action.type) {
    case 'swap-locations':
      if (state.destinationLocked || !origin.value || !destination.value) return state;
      return recalculateRoute({ ...state, origin: destination, destination: origin });
    case 'set-departure':
      return state.departureAt === action.departureAt ? state : recalculateRoute({ ...state, departureAt: action.departureAt });
    case 'set-preference':
      return state.preference === action.preference ? state : recalculateRoute({ ...state, preference: action.preference });
    case 'route-succeeded': {
      if (route.kind !== 'loading' || route.id !== action.id) return state;
      const index = state.requestedAlternative;
      return {
        ...state,
        route: {
          kind: 'success',
          departureAt: action.departureAt,
          alternatives: action.alternatives,
          selectedAlternative: Number.isInteger(index) && action.alternatives[index] ? index : 0,
        },
      };
    }
    case 'route-failed':
      if (route.kind !== 'loading' || route.id !== action.id) return state;
      return { ...state, route: { kind: 'error', message: action.message } };
    case 'cancel-route':
      return route.kind === 'loading' ? { ...state, route: { kind: 'idle' } } : state;
    case 'retry-route':
      return route.kind === 'idle' || route.kind === 'error' ? calculateRoute(state) : state;
    case 'select-alternative':
      if (route.kind !== 'success' || !Number.isInteger(action.index) || !route.alternatives[action.index]) return state;
      return { ...state, route: { ...route, selectedAlternative: action.index } };
  }
}
