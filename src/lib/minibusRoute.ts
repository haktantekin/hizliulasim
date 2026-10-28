import {
  findMinibusLineBySlug,
  getSupportedMinibusCity,
  type MinibusLine,
  type SupportedMinibusCity,
} from './minibusData.ts';

export type MinibusLineRouteResolution =
  | { status: 'unsupported-city' }
  | { status: 'line-not-found' }
  | { status: 'found'; city: SupportedMinibusCity; line: MinibusLine };

export async function resolveMinibusLineRoute({
  citySlug,
  lineSlug,
  loadLines,
}: {
  citySlug: string;
  lineSlug: string;
  loadLines: () => Promise<MinibusLine[]>;
}): Promise<MinibusLineRouteResolution> {
  const city = getSupportedMinibusCity(citySlug);
  if (!city) return { status: 'unsupported-city' };

  const lines = await loadLines();
  const line = findMinibusLineBySlug(lines, lineSlug);
  return line
    ? { status: 'found', city, line }
    : { status: 'line-not-found' };
}

