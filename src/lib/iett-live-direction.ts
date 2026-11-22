import type { IETTHatOtoKonum } from '@/types/iett';

type DirectionFields = Pick<IETTHatOtoKonum, 'guzergahkodu' | 'yon'>;

export function getIettLiveVehicleDirection(vehicle: DirectionFields): string {
  const routeDirection = vehicle.guzergahkodu?.match(/(?:^|_)([DG])(?:_|$)/)?.[1];
  if (routeDirection === 'D' || routeDirection === 'G') return routeDirection;
  return vehicle.yon === 'D' || vehicle.yon === 'G' ? vehicle.yon : '';
}
