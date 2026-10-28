export type RoutePoint = { lat: number; lng: number };
export type LinearRing = number[][];
export type DistrictGeometry =
  | { type: 'Polygon'; coordinates: LinearRing[] }
  | { type: 'MultiPolygon'; coordinates: LinearRing[][] };

export type DistrictBoundary = {
  name: string;
  slug: string;
  geometry: DistrictGeometry;
};

function pointOnSegment(point: RoutePoint, first: number[], second: number[]): boolean {
  const cross = (point.lng - first[0]) * (second[1] - first[1])
    - (point.lat - first[1]) * (second[0] - first[0]);
  if (Math.abs(cross) > 1e-10) return false;
  const dot = (point.lng - first[0]) * (point.lng - second[0])
    + (point.lat - first[1]) * (point.lat - second[1]);
  return dot <= 1e-12;
}

function pointInRing(point: RoutePoint, ring: LinearRing): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const first = ring[index];
    const second = ring[previous];
    if (pointOnSegment(point, first, second)) return false;
    const crosses = (first[1] > point.lat) !== (second[1] > point.lat)
      && point.lng < ((second[0] - first[0]) * (point.lat - first[1])) / (second[1] - first[1]) + first[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: RoutePoint, rings: LinearRing[]): boolean {
  if (!rings[0] || !pointInRing(point, rings[0])) return false;
  return !rings.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointInDistrictGeometry(point: RoutePoint, geometry: DistrictGeometry): boolean {
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
}

function segmentLengthKm(first: RoutePoint, second: RoutePoint): number {
  const radiusKm = 6371.0088;
  const toRadians = Math.PI / 180;
  const latitudeDelta = (second.lat - first.lat) * toRadians;
  const longitudeDelta = (second.lng - first.lng) * toRadians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(first.lat * toRadians) * Math.cos(second.lat * toRadians)
    * Math.sin(longitudeDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolate(first: RoutePoint, second: RoutePoint, ratio: number): RoutePoint {
  return {
    lat: first.lat + (second.lat - first.lat) * ratio,
    lng: first.lng + (second.lng - first.lng) * ratio,
  };
}

export function findRouteDistricts(
  points: RoutePoint[],
  boundaries: DistrictBoundary[],
  options: { minimumInsideKm?: number } = {},
): DistrictBoundary[] {
  if (points.length === 0) return [];
  const minimumInsideKm = options.minimumInsideKm ?? 0.2;

  return boundaries.filter((district) => {
    const endpointInside = pointInDistrictGeometry(points[0], district.geometry)
      || pointInDistrictGeometry(points[points.length - 1], district.geometry);
    if (endpointInside) return true;

    let insideKm = 0;
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1];
      const second = points[index];
      const lengthKm = segmentLengthKm(first, second);
      for (const ratio of [0.125, 0.375, 0.625, 0.875]) {
        if (pointInDistrictGeometry(interpolate(first, second, ratio), district.geometry)) {
          insideKm += lengthKm / 4;
        }
      }
      if (insideKm >= minimumInsideKm) return true;
    }
    return false;
  });
}
