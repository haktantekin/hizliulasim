import type { RoutePreference } from './contracts.ts';

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
  selectedAlternative?: number;
}

const coordinatePrecision = 5;
const maxLabelLength = 120;
const invalidLabelCharacters = /[\p{Cc}\uFFFD]/u;
const coordinatePair = /^(\d{1,2}(?:\.\d{1,5})?),(\d{1,2}(?:\.\d{1,5})?)$/u;
const instant = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;

// Keep share links within the public route API's search area and departure window.
const maxDepartureAheadMs = 7 * 24 * 60 * 60 * 1000;
// The default router returns at most three alternatives.
const maxAlternativeIndex = 2;

function coordinatesInSearchArea(latitude: number, longitude: number): boolean {
  return latitude >= 39.5 && latitude <= 42.5 && longitude >= 26 && longitude <= 31;
}

function getSingleParam(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function getDeparture(value: string | undefined): string | undefined {
  if (!value || value.length > 29) return undefined;
  const match = instant.exec(value);
  if (!match || match[0] !== value || match[1].startsWith('0000')) return undefined;
  const day = new Date(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== match[1]) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + maxDepartureAheadMs) return undefined;
  return new Date(timestamp).toISOString();
}

function isPreference(value: string | undefined): value is RoutePreference {
  return value === 'fastest' || value === 'less-walking' || value === 'fewer-transfers';
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
  if (!coordinatesInSearchArea(latitude, longitude)) return undefined;

  const label = getSingleParam(params, `${key}n`);
  const name = label && label.length <= maxLabelLength * 2 && !invalidLabelCharacters.test(label)
    && [...label].length <= maxLabelLength ? label.trim() : '';
  return { name: name || fallbackName, latitude, longitude };
}

function writeLocation(params: URLSearchParams, key: 'o' | 'd', location: PlannerLocation) {
  const { name, latitude, longitude } = location;
  if (!coordinatesInSearchArea(latitude, longitude)) return;
  const pair = [latitude, longitude].map((value) => Number(value.toFixed(coordinatePrecision))).join(',');
  params.set(key, pair);
  const label = [...name.trim()].slice(0, maxLabelLength).join('').trimEnd();
  if (label && !invalidLabelCharacters.test(label)) params.set(`${key}n`, label);
}

export function buildTransitPlannerUrl(state: ShareablePlannerState): string {
  const params = new URLSearchParams();
  writeLocation(params, 'o', state.origin);
  writeLocation(params, 'd', state.destination);
  const departureAt = getDeparture(state.departureAt);
  if (departureAt) params.set('t', departureAt);
  if (isPreference(state.preference)) params.set('p', state.preference);
  if (isAlternativeIndex(state.selectedAlternative)) params.set('a', String(state.selectedAlternative));
  return params.size ? `/yol-tarifi?${params}` : '/yol-tarifi';
}

export function parseTransitPlannerUrl(params: URLSearchParams): Partial<ShareablePlannerState> {
  const state: Partial<ShareablePlannerState> = {};
  const origin = readLocation(params, 'o', 'Başlangıç');
  const destination = readLocation(params, 'd', 'Hedef');
  const departureAt = getDeparture(getSingleParam(params, 't'));
  const preference = getSingleParam(params, 'p');
  const alternative = getSingleParam(params, 'a');
  if (origin) state.origin = origin;
  if (destination) state.destination = destination;
  if (departureAt) state.departureAt = departureAt;
  if (isPreference(preference)) state.preference = preference;
  if (alternative && /^\d$/u.test(alternative) && isAlternativeIndex(Number(alternative))) {
    state.selectedAlternative = Number(alternative);
  }
  return state;
}
