import type { IETTDurakDetay } from '../../types/iett.ts';
import type { IettStaticPath } from '../../lib/iett-static/contracts.ts';

export type IettRoutePathModel = IettStaticPath;

export function selectIettRoutePath(
  paths: readonly IettStaticPath[],
  stops: readonly IETTDurakDetay[],
  direction: string,
): IettRoutePathModel | null {
  if (direction !== 'D' && direction !== 'G') return null;
  const stored = paths.find((path) => path.direction === direction);
  if (stored) return stored;

  const coordinates = stops
    .filter((stop) => stop.YON === direction)
    .slice()
    .sort((left, right) => left.SIRANO - right.SIRANO)
    .map((stop) => [stop.YKOORDINATI, stop.XKOORDINATI] as [number, number]);
  if (coordinates.length < 2) return null;
  return { direction, quality: 'approximate', coordinates };
}
