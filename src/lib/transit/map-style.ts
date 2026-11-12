export const TRANSIT_BASEMAP_OPACITY = 0.42;

type TransitPathStyleInput = {
  size: 'compact' | 'full';
  dashed: boolean;
  highlighted: boolean;
  dimmed: boolean;
};

type PathLineStyle = {
  weight: number;
  opacity: number;
  dashArray?: string;
  lineCap: 'round';
  lineJoin: 'round';
};

export type TransitPathStyle = {
  casing: PathLineStyle & { color: '#ffffff' };
  route: PathLineStyle;
};

/** Keeps route geometry legible over detailed street tiles without hiding geographic context. */
export function getTransitPathStyle({
  size, dashed, highlighted, dimmed,
}: TransitPathStyleInput): TransitPathStyle {
  const routeWeight = (size === 'compact' ? 6 : 7) + (highlighted ? 2 : 0);
  const dashArray = dashed ? '14 10' : undefined;
  const lineShape = { ...(dashArray ? { dashArray } : {}), lineCap: 'round' as const, lineJoin: 'round' as const };
  return {
    casing: {
      color: '#ffffff',
      weight: routeWeight + 4,
      opacity: highlighted ? 1 : dimmed ? 0.22 : 0.92,
      ...lineShape,
    },
    route: {
      weight: routeWeight,
      opacity: highlighted ? 1 : dimmed ? 0.3 : 1,
      ...lineShape,
    },
  };
}
