import type { RoutePreference, TransitBoardingPoint, TransitItinerary, TransitMode } from './contracts.ts';
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
type TimelineStop = { name: string; href?: string };

export type TimelineItem = { stepIndex: number } & (
  | { kind: 'walk'; mode: 'walking'; durationMinutes: number }
  | { kind: 'board'; mode: RideMode; lineCode: string; stop: TimelineStop }
  | { kind: 'alight'; mode: RideMode; stop: TimelineStop }
);

const siteOrigin = 'https://hizliulasim.com';

export function getModePresentation(mode: TransitMode): ModePresentation {
  return modes[mode];
}

function getStopLabel(point: TransitBoardingPoint): TimelineStop {
  const label: TimelineStop = { name: point.name };
  const href = point.contentLink?.canonicalUrl;
  if (typeof href !== 'string' || /[\s\\\p{Cc}?#]/u.test(href)) return label;

  const path = href.startsWith(`${siteOrigin}/`) ? href.slice(siteOrigin.length) : href;
  if (!path.startsWith('/') || path.startsWith('//')) return label;
  const url = new URL(path, siteOrigin);
  if (url.origin === siteOrigin && url.pathname === path && url.pathname !== '/') label.href = href;
  return label;
}

export function buildTimelineItems(itinerary: TransitItinerary): TimelineItem[] {
  return itinerary.steps.flatMap<TimelineItem>((step, stepIndex) => {
    if (step.kind === 'walk') {
      return { kind: 'walk', mode: step.mode, stepIndex, durationMinutes: step.durationMinutes };
    }

    return [
      { kind: 'board', mode: step.mode, stepIndex, lineCode: step.lineCode, stop: getStopLabel(step.board) },
      { kind: 'alight', mode: step.mode, stepIndex, stop: getStopLabel(step.alight) },
    ];
  });
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
  | ({ kind: 'loading'; id: number } & ShareablePlannerState)
  | { kind: 'success'; departureAt: string; alternatives: TransitItinerary[]; selectedAlternative: number }
  | { kind: 'error'; message: string };

export interface PlannerState {
  origin: PlannerEndpoint;
  destination: PlannerEndpoint;
  destinationLocked: boolean;
  departureAt: string;
  preference: RoutePreference;
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

export function isPlannerLocation(value: PlannerLocation | undefined): value is PlannerLocation {
  return value !== undefined && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}

function selectedEndpoint(location?: PlannerLocation): PlannerEndpoint {
  const value = isPlannerLocation(location) ? location : null;
  return { value, query: value?.name ?? '', lookup: { kind: 'idle' } };
}

function calculateRoute(state: PlannerState, selectedAlternative?: number): PlannerState {
  const { origin, destination, departureAt, preference } = state;
  if (!origin.value || !destination.value) return { ...state, route: { kind: 'idle' } };
  const id = state.serial + 1;
  return {
    ...state,
    serial: id,
    route: { kind: 'loading', id, origin: origin.value, destination: destination.value, departureAt, preference, selectedAlternative },
  };
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
    route: { kind: 'idle' },
    serial: 0,
  }, initialState.selectedAlternative);
}

function replaceEndpoint(
  state: PlannerState, role: PlannerEndpointRole, endpoint: PlannerEndpoint,
): PlannerState {
  const next = { ...state, [role]: endpoint };
  return state[role].value === endpoint.value ? next : calculateRoute(next);
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
    case 'resolve-location':
      if ((lookup.kind !== 'details' && lookup.kind !== 'geolocation') || lookup.id !== action.id) return state;
      if (isPlannerLocation(action.value)) return replaceEndpoint(state, role, selectedEndpoint(action.value));
      return replaceEndpoint(state, role, {
        ...endpoint, lookup: { kind: 'error', message: 'Konumun koordinatları alınamadı. Yer aramasını kullanabilirsiniz.' },
      });
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
      return calculateRoute({ ...state, origin: destination, destination: origin });
    case 'set-departure':
      return state.departureAt === action.departureAt ? state : calculateRoute({ ...state, departureAt: action.departureAt });
    case 'set-preference':
      return state.preference === action.preference ? state : calculateRoute({ ...state, preference: action.preference });
    case 'route-succeeded': {
      if (route.kind !== 'loading' || route.id !== action.id) return state;
      const index = route.selectedAlternative ?? 0;
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
