export const routeSearchBounds = {
  latitude: [39.5, 42.5],
  longitude: [26, 31],
} as const;

export function coordinatesInRouteSearchArea(latitude: number, longitude: number): boolean {
  const { latitude: [minLat, maxLat], longitude: [minLng, maxLng] } = routeSearchBounds;
  return Number.isFinite(latitude) && latitude >= minLat && latitude <= maxLat
    && Number.isFinite(longitude) && longitude >= minLng && longitude <= maxLng;
}
