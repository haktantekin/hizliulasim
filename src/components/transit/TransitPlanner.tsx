'use client';

import { useEffect, useReducer, type Dispatch } from 'react';
import { ArrowLeftRight, Maximize2 } from 'lucide-react';
import { requestTransitRoutes, TransitRouteError } from '@/lib/transit/client';
import {
  createPlannerState,
  getCurrentDepartureAt,
  getCurrentLocationButtonVisibility,
  isPlannerLocation,
  reducePlanner,
  type PlannerAction,
  type PlannerEndpointRole,
  type PlannerLookup,
  type PlannerPrediction,
  type PlannerRoute,
} from '@/lib/transit/presentation';
import { buildTransitPlannerUrl, type PlannerLocation, type ShareablePlannerState } from '@/lib/transit/share-url';
import TransitAlternatives from './TransitAlternatives';
import TransitItinerary from './TransitItinerary';
import TransitLocationField from './TransitLocationField';
import TransitPlannerOptions from './TransitPlannerOptions';
import TransitPlannerStatus from './TransitPlannerStatus';
import TransitRouteMapLoader from './TransitRouteMapLoader';
import TransitSummary from './TransitSummary';

export interface TransitPlannerProps {
  variant: 'full' | 'home' | 'detail';
  fixedDestination?: PlannerLocation;
  initialState?: Partial<ShareablePlannerState>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readPredictions(payload: unknown): PlannerPrediction[] {
  if (!isRecord(payload) || !Array.isArray(payload.predictions)) throw new Error('Invalid place suggestions');
  const results = new Map<string, PlannerPrediction>();
  for (const prediction of payload.predictions) {
    if (isRecord(prediction) && typeof prediction.place_id === 'string' && prediction.place_id
      && typeof prediction.description === 'string' && prediction.description.trim()) {
      results.set(prediction.place_id, { id: prediction.place_id, description: prediction.description });
    }
  }
  return [...results.values()];
}

async function fetchPlaceData(path: 'autocomplete' | 'details', params: URLSearchParams, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/maps/${path}?${params}`, { signal });
  if (!response.ok) throw new Error('Place lookup failed');
  return response.json();
}

function useLocationLookup(role: PlannerEndpointRole, lookup: PlannerLookup, dispatch: Dispatch<PlannerAction>) {
  useEffect(() => {
    if (lookup.kind === 'geolocation') {
      const { id } = lookup;
      let active = true;
      function fail(message: string) {
        if (active) dispatch({ type: 'lookup-failed', role, id, message });
      }
      if (!navigator.geolocation) {
        fail('Tarayıcınız konum paylaşımını desteklemiyor. Bir yer arayabilirsiniz.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (active) {
            const value = { name: 'Konumum', latitude: coords.latitude, longitude: coords.longitude };
            dispatch({ type: 'resolve-location', role, id, value });
          }
        },
        (error) => fail(error.code === 1
          ? 'Konum izni verilmedi. Bir yer arayabilirsiniz.'
          : 'Konumunuz alınamadı. Bir yer arayabilir veya tekrar deneyebilirsiniz.'),
        { timeout: 10000 },
      );
      return () => { active = false; };
    }
    if (lookup.kind !== 'search' && lookup.kind !== 'details') return;

    const { id } = lookup;
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(async () => {
      try {
        if (lookup.kind === 'search') {
          const payload = await fetchPlaceData('autocomplete', new URLSearchParams({ input: lookup.query }), signal);
          if (!signal.aborted) dispatch({ type: 'suggestions', role, id, predictions: readPredictions(payload) });
        } else {
          const { prediction } = lookup;
          const payload = await fetchPlaceData('details', new URLSearchParams({ place_id: prediction.id }), signal);
          if (!isRecord(payload) || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
            throw new Error('Invalid place coordinates');
          }
          const value = { name: prediction.description, latitude: payload.lat, longitude: payload.lng };
          if (!signal.aborted) dispatch({ type: 'resolve-location', role, id, value });
        }
      } catch {
        if (!signal.aborted) dispatch({
          type: 'lookup-failed', role, id, message: lookup.kind === 'search'
            ? 'Yer araması yapılamadı. Tekrar deneyin.'
            : 'Seçilen yerin koordinatları alınamadı. Başka bir yer seçebilirsiniz.',
        });
      }
    }, lookup.kind === 'search' ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [dispatch, lookup, role]);
}

function useRouteRequest(route: PlannerRoute, dispatch: Dispatch<PlannerAction>) {
  const request = route.kind === 'loading' ? route : null;
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    const { signal } = controller;
    const { id, origin, destination, preference } = request;

    // A deferred start lets the development effect replay cancel the first setup before it sends a request.
    queueMicrotask(async () => {
      if (signal.aborted) return;
      const departureAt = request.departureAt ? new Date(request.departureAt) : new Date();
      try {
        const { itineraries } = await requestTransitRoutes({
          origin: [origin.latitude, origin.longitude],
          destination: [destination.latitude, destination.longitude],
          departureAt,
          preference,
        }, signal);
        if (!signal.aborted) dispatch({ type: 'route-succeeded', id, departureAt: departureAt.toISOString(), alternatives: itineraries });
      } catch (error) {
        if (!signal.aborted) dispatch({
          type: 'route-failed',
          id,
          message: error instanceof TransitRouteError ? error.message : new TransitRouteError('DATA_UNAVAILABLE').message,
        });
      }
    });
    return () => controller.abort();
  }, [dispatch, request]);
}

function PlannerControls({ variant, fixedDestination, initialState }: TransitPlannerProps) {
  const [state, dispatch] = useReducer(
    reducePlanner, { initialState, fixedDestination },
    (props) => createPlannerState(props.initialState, props.fixedDestination),
  );
  const { origin, destination, destinationLocked, preference, route } = state;
  useLocationLookup('origin', origin.lookup, dispatch);
  useLocationLookup('destination', destination.lookup, dispatch);
  useRouteRequest(route, dispatch);

  const compact = variant !== 'full';
  const currentLocationButtons = getCurrentLocationButtonVisibility(variant, origin, destination);
  const canCalculate = Boolean(origin.value && destination.value);
  const activeItinerary = route.kind === 'success' ? route.alternatives[route.selectedAlternative] : null;
  const fieldLayout = destinationLocked ? 'sm:grid-cols-2'
    : compact ? 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
      : 'md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]';

  return (
    <div className="grid gap-4">
      <div className={`grid items-start gap-3 ${fieldLayout}`}>
        <TransitLocationField
          role="origin"
          {...origin}
          allowCurrentLocation={currentLocationButtons.origin}
          dispatch={dispatch}
        />
        {!destinationLocked && (
          <button
            type="button"
            aria-label="Başlangıç ve hedefin yerini değiştir"
            disabled={!canCalculate}
            onClick={() => dispatch({ type: 'swap-locations' })}
            className="min-h-10 justify-self-center rounded-xl border border-gray-200 bg-white px-3 text-brand-soft-blue hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-soft-blue disabled:opacity-40 sm:mt-6"
          >
            <ArrowLeftRight aria-hidden="true" className="size-4" />
          </button>
        )}
        <TransitLocationField
          role="destination"
          {...destination}
          locked={destinationLocked}
          allowCurrentLocation={currentLocationButtons.destination}
          dispatch={dispatch}
        />
      </div>
      <TransitPlannerOptions
        compact={compact}
        preference={preference}
        onPreferenceChange={(value) => dispatch({ type: 'set-preference', preference: value })}
      />
      <TransitPlannerStatus
        route={route}
        canCalculate={canCalculate}
        onCancel={() => dispatch({ type: 'cancel-route' })}
        onRetry={() => dispatch({ type: 'retry-route', departureAt: getCurrentDepartureAt() })}
      />
      {route.kind === 'success' && activeItinerary && (
        <div className="grid gap-2">
          {route.alternatives.length > 1 ? (
            <TransitAlternatives
              alternatives={route.alternatives}
              selectedAlternative={route.selectedAlternative}
              onSelect={(index) => dispatch({ type: 'select-alternative', index })}
            />
          ) : (
            <div className="rounded-xl bg-brand-light-blue/30 p-3">
              <TransitSummary itinerary={activeItinerary} />
            </div>
          )}
          <TransitItinerary
            itinerary={activeItinerary}
            compact={compact}
            selectedStep={route.selectedStep}
            onSelectStep={(index) => dispatch({ type: 'select-step', index })}
          />
          <TransitRouteMapLoader
            itinerary={activeItinerary}
            size={compact ? 'compact' : 'full'}
            selectedAlternative={route.selectedAlternative}
            selectedStep={route.selectedStep}
          />
          {compact && origin.value && destination.value && (
            // The coordinate-bearing URL needs a document load for the planner's telemetry sanitization.
            <a
              href={buildTransitPlannerUrl({
                origin: origin.value,
                destination: destination.value,
                departureAt: route.departureAt,
                preference,
                selectedAlternative: route.selectedAlternative,
              })}
              className="inline-flex min-h-10 items-center gap-1.5 justify-self-start rounded text-sm font-semibold text-brand-soft-blue hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue"
            >
              <Maximize2 aria-hidden="true" className="size-4" />
              Büyük haritada aç
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function TransitPlanner({ variant, fixedDestination, initialState }: TransitPlannerProps) {
  if (variant === 'detail' && !isPlannerLocation(fixedDestination)) return null;
  const destinationKey = fixedDestination
    ? JSON.stringify([fixedDestination.latitude, fixedDestination.longitude, fixedDestination.name])
    : undefined;
  return <PlannerControls key={destinationKey} variant={variant} fixedDestination={fixedDestination} initialState={initialState} />;
}
