import type { Coordinate, TransitItinerary, TransitRouteRequest } from './contracts.ts';

type WalkingRouteErrorCode = 'NO_ROUTE' | 'DATA_UNAVAILABLE';

export class WalkingRouteError extends Error {
  readonly code: WalkingRouteErrorCode;

  constructor(code: WalkingRouteErrorCode) {
    super(code);
    this.name = 'WalkingRouteError';
    this.code = code;
  }
}

interface WalkingRouteOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNumber(value: unknown): number {
  if (!isRecord(value) || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0) {
    throw new WalkingRouteError('DATA_UNAVAILABLE');
  }
  return value.value;
}

function readDelta(encoded: string, start: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let index = start;
  while (index < encoded.length) {
    const byte = encoded.charCodeAt(index++) - 63;
    if (byte < 0 || byte > 63 || shift > 30) throw new WalkingRouteError('DATA_UNAVAILABLE');
    result |= (byte & 0x1f) << shift;
    if (byte < 0x20) return { value: (result & 1) ? ~(result >> 1) : result >> 1, next: index };
    shift += 5;
  }
  throw new WalkingRouteError('DATA_UNAVAILABLE');
}

export function decodeGooglePolyline(encoded: string): Coordinate[] {
  if (!encoded || encoded.length > 200_000) throw new WalkingRouteError('DATA_UNAVAILABLE');
  const coordinates: Coordinate[] = [];
  let latitude = 0;
  let longitude = 0;
  let index = 0;
  while (index < encoded.length) {
    const lat = readDelta(encoded, index);
    const lng = readDelta(encoded, lat.next);
    latitude += lat.value;
    longitude += lng.value;
    const point: Coordinate = [latitude / 1e5, longitude / 1e5];
    if (Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180) throw new WalkingRouteError('DATA_UNAVAILABLE');
    coordinates.push(point);
    if (coordinates.length > 20_000) throw new WalkingRouteError('DATA_UNAVAILABLE');
    index = lng.next;
  }
  if (coordinates.length < 2) throw new WalkingRouteError('DATA_UNAVAILABLE');
  return coordinates;
}

function istanbulDate(value: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function istanbulClock(value: Date): string {
  const parts = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('hour')}:${read('minute')}`;
}

export function buildWalkingItineraryFromGoogle(
  payload: unknown,
  query: TransitRouteRequest,
  generatedAt: Date,
): TransitItinerary {
  if (!isRecord(payload) || payload.status !== 'OK' || !Array.isArray(payload.routes) || !isRecord(payload.routes[0])) {
    throw new WalkingRouteError(payload && isRecord(payload) && payload.status === 'ZERO_RESULTS' ? 'NO_ROUTE' : 'DATA_UNAVAILABLE');
  }
  const route = payload.routes[0];
  const polyline = isRecord(route.overview_polyline) ? route.overview_polyline.points : undefined;
  const leg = Array.isArray(route.legs) ? route.legs[0] : undefined;
  if (typeof polyline !== 'string' || !isRecord(leg)) throw new WalkingRouteError('DATA_UNAVAILABLE');

  const durationSeconds = readNumber(leg.duration);
  const distanceMeters = readNumber(leg.distance);
  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const arrival = new Date(query.departureAt.getTime() + durationSeconds * 1000);
  const departureTime = istanbulClock(query.departureAt);
  const arrivalTime = istanbulClock(arrival);

  return {
    durationMinutes,
    walkingMinutes: durationMinutes,
    transferCount: 0,
    departureTime,
    arrivalTime,
    steps: [{
      kind: 'walk', mode: 'walking', durationMinutes, distanceMeters: Math.round(distanceMeters),
      departureTime, arrivalTime, geometryQuality: 'exact', geometry: decodeGooglePolyline(polyline),
    }],
    keyPoints: [
      { role: 'origin', name: 'Başlangıç', coordinate: query.origin },
      { role: 'destination', name: 'Hedef', coordinate: query.destination },
    ],
    metadata: {
      dataVersion: 'google-directions', generatedAt: generatedAt.toISOString(),
      serviceDate: istanbulDate(query.departureAt), approximateWalking: false, geometryQuality: 'exact',
    },
  };
}

export async function requestGoogleWalkingItinerary(
  query: TransitRouteRequest,
  {
    apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_KEY,
    fetcher = fetch,
    now = () => new Date(),
    signal,
  }: WalkingRouteOptions = {},
): Promise<TransitItinerary> {
  if (!apiKey) throw new WalkingRouteError('DATA_UNAVAILABLE');
  const params = new URLSearchParams({
    origin: query.origin.join(','), destination: query.destination.join(','),
    mode: 'walking', language: 'tr', key: apiKey,
  });
  try {
    const response = await fetcher(`https://maps.googleapis.com/maps/api/directions/json?${params}`, {
      signal, cache: 'no-store',
    });
    if (!response.ok) throw new WalkingRouteError('DATA_UNAVAILABLE');
    return buildWalkingItineraryFromGoogle(await response.json(), query, now());
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof WalkingRouteError) throw error;
    throw new WalkingRouteError('DATA_UNAVAILABLE');
  }
}
