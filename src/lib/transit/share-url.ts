import type { RoutePreference, RouteTravelMode } from './contracts.ts';
import { canonicalizeRouteCoordinates, coordinatesInRouteSearchArea } from './route-search-area.ts';

export interface PlannerLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface ShareablePlannerState {
  origin: PlannerLocation;
  destination: PlannerLocation;
  departureAt: string;
  preference: RoutePreference;
  travelMode: RouteTravelMode;
  selectedAlternative?: number;
}

const maxLabelLength = 120;
const invalidLabelCharacters = /[\p{Cc}\uFFFD]/u;
const coordinatePair = /^(\d{1,2}(?:\.\d{1,5})?),(\d{1,2}(?:\.\d{1,5})?)$/u;
// The default router returns at most three alternatives.
const maxAlternativeIndex = 2;

function getSingleParam(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function isPreference(value: string | undefined): value is RoutePreference {
  return value === 'fastest' || value === 'less-walking' || value === 'fewer-transfers';
}

function isTravelMode(value: string | undefined): value is RouteTravelMode {
  return value === 'transit' || value === 'walking' || value === 'bus' || value === 'metro';
}

function isAlternativeIndex(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value <= maxAlternativeIndex;
}

function readLocation(
  params: URLSearchParams, key: 'o' | 'd', fallbackName: string,
): PlannerLocation | undefined {
  const raw = getSingleParam(params, key);
  const match = raw && coordinatePair.exec(raw);
  if (!match || match[0] !== raw) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!coordinatesInRouteSearchArea(latitude, longitude)) return undefined;

  const label = getSingleParam(params, `${key}n`);
  const name = label && label.length <= maxLabelLength * 2 && !invalidLabelCharacters.test(label)
    && [...label].length <= maxLabelLength ? label.trim() : '';
  return { name: name || fallbackName, latitude, longitude };
}

function writeLocation(params: URLSearchParams, key: 'o' | 'd', location: PlannerLocation) {
  const { name, latitude, longitude } = location;
  const pair = canonicalizeRouteCoordinates(latitude, longitude);
  if (!pair) return;
  params.set(key, pair.join(','));
  const label = [...name.trim()].slice(0, maxLabelLength).join('').trimEnd();
  if (label && !invalidLabelCharacters.test(label)) params.set(`${key}n`, label);
}

export function buildTransitPlannerUrl(state: ShareablePlannerState): string {
  const params = new URLSearchParams();
  writeLocation(params, 'o', state.origin);
  writeLocation(params, 'd', state.destination);
  if (isPreference(state.preference)) params.set('p', state.preference);
  if (isTravelMode(state.travelMode)) params.set('m', state.travelMode);
  if (isAlternativeIndex(state.selectedAlternative)) params.set('a', String(state.selectedAlternative));
  const query = params.toString();
  return query ? `/yol-tarifi?${query}` : '/yol-tarifi';
}

export function buildTransitPlannerDestinationUrl(destination: PlannerLocation): string {
  const params = new URLSearchParams();
  writeLocation(params, 'd', destination);
  const query = params.toString();
  return query ? `/yol-tarifi?${query}` : '/yol-tarifi';
}

export function parseTransitPlannerUrl(params: URLSearchParams): Partial<ShareablePlannerState> {
  const state: Partial<ShareablePlannerState> = {};
  const origin = readLocation(params, 'o', 'Başlangıç');
  const destination = readLocation(params, 'd', 'Hedef');
  const preference = getSingleParam(params, 'p');
  const travelMode = getSingleParam(params, 'm');
  const alternative = getSingleParam(params, 'a');
  if (origin) state.origin = origin;
  if (destination) state.destination = destination;
  if (isPreference(preference)) state.preference = preference;
  if (isTravelMode(travelMode)) state.travelMode = travelMode;
  if (alternative && /^\d$/u.test(alternative) && isAlternativeIndex(Number(alternative))) {
    state.selectedAlternative = Number(alternative);
  }
  return state;
}
