import type { IETTDurakDetay } from '@/types/iett';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearestStopResult {
  stop: IETTDurakDetay;
  distance: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lon2 - lon1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestStop(
  duraklar: IETTDurakDetay[],
  direction: string,
  location: Coordinates,
): NearestStopResult | null {
  let closest: IETTDurakDetay | null = null;
  let minimumDistance = Number.POSITIVE_INFINITY;

  for (const stop of duraklar) {
    if (stop.YON !== direction) continue;
    if (
      !Number.isFinite(stop.YKOORDINATI) ||
      !Number.isFinite(stop.XKOORDINATI) ||
      stop.YKOORDINATI === 0 ||
      stop.XKOORDINATI === 0
    ) {
      continue;
    }

    const distance = haversineDistance(
      location.lat,
      location.lng,
      stop.YKOORDINATI,
      stop.XKOORDINATI,
    );
    if (distance < minimumDistance) {
      minimumDistance = distance;
      closest = stop;
    }
  }

  return closest ? { stop: closest, distance: minimumDistance } : null;
}
