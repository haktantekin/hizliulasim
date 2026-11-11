import type { TransitItinerary, TransitRouteRequest } from './contracts.ts';
import { canonicalizeRouteCoordinates } from './route-search-area.ts';

const errorMessages = {
  INVALID_REQUEST: 'Konum, kalkış zamanı veya rota tercihi geçersiz.',
  NO_ROUTE: 'Bu yolculuk için toplu taşıma rotası bulunamadı. Başlangıç veya hedefi değiştirmeyi deneyin.',
  DATA_UNAVAILABLE: 'Toplu taşıma verileri şu anda kullanılamıyor.',
  ROUTE_TIMEOUT: 'Rota araması zaman sınırına ulaştı. Tekrar deneyin.',
} as const;

export type TransitRouteErrorCode = keyof typeof errorMessages;

export class TransitRouteError extends Error {
  readonly code: TransitRouteErrorCode;

  constructor(code: TransitRouteErrorCode) {
    super(errorMessages[code]);
    this.name = 'TransitRouteError';
    this.code = code;
  }
}

export interface TransitRouteResponse {
  itineraries: TransitItinerary[];
  metadata: { dataVersion: string; usedFallback: boolean };
  diagnostics: {
    connectionBuckets: number;
    connectionShards: number;
    originCandidates: number;
    destinationCandidates: number;
  };
}

const rideModes = new Set(['bus', 'metro', 'tram', 'rail', 'ferry', 'funicular', 'minibus']);
const pointRoles = new Set(['origin', 'board', 'alight', 'transfer', 'destination']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonnegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCoordinate(value: unknown): boolean {
  return Array.isArray(value) && value.length === 2
    && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90
    && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180;
}

function isGeometryQuality(value: unknown): boolean {
  return value === 'exact' || value === 'approximate';
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && isCoordinate(value.coordinate)
    && typeof value.role === 'string' && pointRoles.has(value.role)
    && (value.code === undefined || typeof value.code === 'string')
    && (value.stopId === undefined || typeof value.stopId === 'string')
    && (value.contentLink === undefined || (isRecord(value.contentLink)
      && typeof value.contentLink.title === 'string' && typeof value.contentLink.canonicalUrl === 'string'));
}

function isStep(value: unknown): boolean {
  if (!isRecord(value)
    || !isNonnegativeNumber(value.durationMinutes) || !isNonnegativeNumber(value.distanceMeters)
    || typeof value.departureTime !== 'string' || typeof value.arrivalTime !== 'string'
    || !isGeometryQuality(value.geometryQuality)
    || !Array.isArray(value.geometry) || !value.geometry.every(isCoordinate)) return false;

  if (value.kind === 'walk') return value.mode === 'walking';
  return value.kind === 'ride' && typeof value.mode === 'string' && rideModes.has(value.mode)
    && typeof value.lineCode === 'string' && typeof value.color === 'string'
    && isNonnegativeNumber(value.stopCount) && isPoint(value.board) && isPoint(value.alight);
}

function isItinerary(value: unknown): boolean {
  return isRecord(value)
    && isNonnegativeNumber(value.durationMinutes) && isNonnegativeNumber(value.walkingMinutes)
    && isNonnegativeNumber(value.transferCount)
    && typeof value.departureTime === 'string' && typeof value.arrivalTime === 'string'
    && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.every(isStep)
    && Array.isArray(value.keyPoints) && value.keyPoints.every(isPoint)
    && isRecord(value.metadata) && typeof value.metadata.dataVersion === 'string'
    && typeof value.metadata.generatedAt === 'string' && typeof value.metadata.serviceDate === 'string'
    && typeof value.metadata.approximateWalking === 'boolean' && isGeometryQuality(value.metadata.geometryQuality);
}

function isRouteResponse(value: unknown): value is TransitRouteResponse {
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.diagnostics)) return false;
  const { metadata, diagnostics, itineraries } = value;
  return typeof metadata.dataVersion === 'string' && typeof metadata.usedFallback === 'boolean'
    && isNonnegativeNumber(diagnostics.connectionBuckets) && isNonnegativeNumber(diagnostics.connectionShards)
    && isNonnegativeNumber(diagnostics.originCandidates) && isNonnegativeNumber(diagnostics.destinationCandidates)
    && Array.isArray(itineraries) && itineraries.length > 0 && itineraries.every(isItinerary);
}

function getErrorCode(value: unknown): TransitRouteErrorCode {
  const code = isRecord(value) && isRecord(value.error) ? value.error.code : undefined;
  return typeof code === 'string' && Object.hasOwn(errorMessages, code)
    ? code as TransitRouteErrorCode
    : 'DATA_UNAVAILABLE';
}

export async function requestTransitRoutes(
  input: TransitRouteRequest,
  signal?: AbortSignal,
): Promise<TransitRouteResponse> {
  signal?.throwIfAborted();
  const origin = canonicalizeRouteCoordinates(...input.origin);
  const destination = canonicalizeRouteCoordinates(...input.destination);
  if (!origin || !destination || !Number.isFinite(input.departureAt.getTime())) {
    throw new TransitRouteError('INVALID_REQUEST');
  }

  const body = JSON.stringify({
    originLat: origin[0],
    originLng: origin[1],
    destinationLat: destination[0],
    destinationLng: destination[1],
    departureAt: input.departureAt.toISOString(),
    preference: input.preference,
  });

  let response: Response;
  let payload: unknown;
  try {
    response = await fetch('/api/transit/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal,
      cache: 'no-store',
    });
    payload = await response.json();
  } catch {
    signal?.throwIfAborted();
    throw new TransitRouteError('DATA_UNAVAILABLE');
  }

  signal?.throwIfAborted();
  if (!response.ok) throw new TransitRouteError(getErrorCode(payload));
  if (!isRouteResponse(payload)) throw new TransitRouteError('DATA_UNAVAILABLE');
  return payload;
}
