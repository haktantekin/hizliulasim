import * as THREE from 'three';
import type { IETTDurakDetay } from '@/types/iett';
import type { IettRoutePathModel } from './route-path';

export interface RouteMap3DProps {
  duraklar: IETTDurakDetay[];
  selectedDirection: string;
  path: IettRoutePathModel | null;
}

export type LngLatPoint = [longitude: number, latitude: number];

const STOP_DWELL_MS = 1_800;
const AVERAGE_TRAVEL_MS = 5_500;

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function getDirectionStops(duraklar: readonly IETTDurakDetay[], direction: string) {
  return duraklar
    .filter((stop) => stop.YON === direction
      && isValidCoordinate(stop.YKOORDINATI, stop.XKOORDINATI))
    .sort((left, right) => left.SIRANO - right.SIRANO);
}

export function getRoutePoints(
  path: IettRoutePathModel | null,
  stops: readonly IETTDurakDetay[],
): LngLatPoint[] {
  const storedPoints = path?.coordinates
    .filter(([latitude, longitude]) => isValidCoordinate(latitude, longitude))
    .map(([latitude, longitude]): LngLatPoint => [longitude, latitude]) ?? [];
  if (storedPoints.length >= 2) return storedPoints;
  return stops.map((stop) => [stop.XKOORDINATI, stop.YKOORDINATI]);
}

export function getBearing(points: readonly LngLatPoint[]) {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  const deltaLongitude = last[0] - first[0];
  const deltaLatitude = last[1] - first[1];
  return Math.atan2(deltaLongitude, deltaLatitude) * 180 / Math.PI;
}

export function makeBus() {
  const bus = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9bd7ee, roughness: 0.25, metalness: 0.08 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 5), yellow);
  body.position.z = 1;
  bus.add(body);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(15, 3.8, 5.2), glass);
  windows.position.set(-1.2, 1.4, 1.1);
  bus.add(windows);

  const frontWindow = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 5.2), glass);
  frontWindow.position.set(10.2, 1.4, 1.1);
  bus.add(frontWindow);

  for (const x of [-8.2, 8.2]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 5.8, 18), dark);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, -4.8, 1.2);
    bus.add(wheel);
  }

  return bus;
}

export function disposeMeshResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

// Use normalized Web Mercator coordinates so the journey is independent of the map renderer.
function project([longitude, latitude]: LngLatPoint) {
  const x = (180 + longitude) / 360;
  const y = (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)))) / 360;
  return new THREE.Vector2(x, y);
}

function unproject({ x, y }: THREE.Vector2): LngLatPoint {
  const latitude = 360 / Math.PI * Math.atan(Math.exp((180 - y * 360) * Math.PI / 180)) - 90;
  return [x * 360 - 180, latitude];
}

function getRouteDistances(points: readonly THREE.Vector2[]) {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances[index - 1] + points[index].distanceTo(points[index - 1]));
  }
  return distances;
}

function getRoutePoint(
  points: readonly THREE.Vector2[],
  distances: readonly number[],
  targetDistance: number,
): LngLatPoint {
  if (points.length === 1) return unproject(points[0]);

  let low = 1;
  let high = distances.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (distances[middle] < targetDistance) low = middle + 1;
    else high = middle;
  }

  const segmentDistance = distances[low] - distances[low - 1];
  const segmentProgress = segmentDistance === 0
    ? 0
    : (targetDistance - distances[low - 1]) / segmentDistance;
  return unproject(new THREE.Vector2().lerpVectors(points[low - 1], points[low], segmentProgress));
}

function getStopRouteDistances(
  stops: readonly IETTDurakDetay[],
  routePoints: readonly THREE.Vector2[],
  routeDistances: readonly number[],
) {
  let routeCursor = 0;

  return stops.map((stop) => {
    const stopPoint = project([stop.XKOORDINATI, stop.YKOORDINATI]);
    let nearestIndex = routeCursor;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = routeCursor; index < routePoints.length; index += 1) {
      const distance = routePoints[index].distanceToSquared(stopPoint);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    routeCursor = nearestIndex;
    return routeDistances[nearestIndex];
  });
}

function getBusMotion(
  elapsed: number,
  stopDistances: readonly number[],
  stopArrivalTimes: readonly number[],
) {
  const lastIndex = stopDistances.length - 1;
  for (let index = 0; index < lastIndex; index += 1) {
    const nextArrival = stopArrivalTimes[index + 1];
    if (elapsed >= nextArrival) continue;

    const departure = stopArrivalTimes[index] + STOP_DWELL_MS;
    if (elapsed < departure) {
      return { distance: stopDistances[index], activeStopIndex: index, atStop: true };
    }

    const progress = (elapsed - departure) / (nextArrival - departure);
    const easedProgress = progress * progress * (3 - 2 * progress);
    return {
      distance: THREE.MathUtils.lerp(stopDistances[index], stopDistances[index + 1], easedProgress),
      activeStopIndex: index + 1,
      atStop: false,
    };
  }

  return { distance: stopDistances[lastIndex], activeStopIndex: lastIndex, atStop: true };
}

/** Returns a looping animation for a direction with at least one stop and one route point. */
export function createBusJourney(
  stops: readonly IETTDurakDetay[],
  routePoints: readonly LngLatPoint[],
) {
  const firstStopPoint = project([stops[0].XKOORDINATI, stops[0].YKOORDINATI]);
  const points = routePoints.map(project);
  if (firstStopPoint.distanceToSquared(points[0]) > firstStopPoint.distanceToSquared(points[points.length - 1])) {
    points.reverse();
  }

  const distances = getRouteDistances(points);
  const totalDistance = distances[distances.length - 1];
  const stopDistances = getStopRouteDistances(stops, points, distances);
  const segmentDistances = stopDistances.slice(0, -1).map((distance, index) => (
    Math.max(stopDistances[index + 1] - distance, 0)
  ));
  const movingSegments = segmentDistances.filter((distance) => distance > 0);
  const averageSegmentDistance = movingSegments.length > 0
    ? movingSegments.reduce((total, distance) => total + distance, 0) / movingSegments.length
    : 1;
  const stopArrivalTimes = [0];
  segmentDistances.forEach((distance, index) => {
    const travelDuration = THREE.MathUtils.clamp(
      AVERAGE_TRAVEL_MS * distance / averageSegmentDistance,
      3_200,
      9_000,
    );
    stopArrivalTimes.push(stopArrivalTimes[index] + STOP_DWELL_MS + travelDuration);
  });
  const cycleDuration = stopArrivalTimes[stopArrivalTimes.length - 1] + STOP_DWELL_MS;

  function sample(elapsedMs: number) {
    const { distance, activeStopIndex, atStop } = getBusMotion(elapsedMs % cycleDuration, stopDistances, stopArrivalTimes);
    const nextDistance = Math.min(distance + totalDistance * 0.0008, totalDistance);
    return {
      point: getRoutePoint(points, distances, distance),
      nextPoint: getRoutePoint(points, distances, nextDistance),
      activeStopIndex,
      atStop,
    };
  }

  return { sample, stopArrivalTimes };
}
