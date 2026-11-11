import type { TransitBoardingPoint, TransitItinerary, TransitMode } from './contracts.ts';

const modes = {
  walking: { label: 'Yürüme', color: '#6b7280', icon: 'footprints' },
  bus: { label: 'Otobüs', color: '#f59e0b', icon: 'bus' },
  metro: { label: 'Metro', color: '#dc2626', icon: 'train-front' },
  tram: { label: 'Tramvay', color: '#e11d48', icon: 'tram-front' },
  rail: { label: 'Tren', color: '#881337', icon: 'train-track' },
  ferry: { label: 'Vapur', color: '#2563eb', icon: 'ship' },
  funicular: { label: 'Füniküler', color: '#be123c', icon: 'cable-car' },
  minibus: { label: 'Minibüs', color: '#7c3aed', icon: 'van' },
} as const satisfies Record<TransitMode, { label: string; color: string; icon: string }>;

export type ModePresentation = (typeof modes)[TransitMode];

type RideMode = Exclude<TransitMode, 'walking'>;
type TimelineStop = { name: string; href?: string };

export type TimelineItem = { stepIndex: number } & (
  | { kind: 'walk'; mode: 'walking'; durationMinutes: number }
  | { kind: 'board'; mode: RideMode; lineCode: string; stop: TimelineStop }
  | { kind: 'alight'; mode: RideMode; stop: TimelineStop }
);

const siteOrigin = 'https://hizliulasim.com';

export function getModePresentation(mode: TransitMode): ModePresentation {
  return modes[mode];
}

function getStopLabel(point: TransitBoardingPoint): TimelineStop {
  const label: TimelineStop = { name: point.name };
  const href = point.contentLink?.canonicalUrl;
  if (typeof href !== 'string' || /[\s\\\p{Cc}?#]/u.test(href)) return label;

  const path = href.startsWith(`${siteOrigin}/`) ? href.slice(siteOrigin.length) : href;
  if (!path.startsWith('/') || path.startsWith('//')) return label;
  const url = new URL(path, siteOrigin);
  if (url.origin === siteOrigin && url.pathname === path && url.pathname !== '/') label.href = href;
  return label;
}

export function buildTimelineItems(itinerary: TransitItinerary): TimelineItem[] {
  return itinerary.steps.flatMap<TimelineItem>((step, stepIndex) => {
    if (step.kind === 'walk') {
      return { kind: 'walk', mode: step.mode, stepIndex, durationMinutes: step.durationMinutes };
    }

    return [
      { kind: 'board', mode: step.mode, stepIndex, lineCode: step.lineCode, stop: getStopLabel(step.board) },
      { kind: 'alight', mode: step.mode, stepIndex, stop: getStopLabel(step.alight) },
    ];
  });
}
