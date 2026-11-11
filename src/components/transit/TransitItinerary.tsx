import { Bus, CableCar, Footprints, Ship, TrainFront, TrainTrack, TramFront, Van } from 'lucide-react';
import type { TransitItinerary as Itinerary } from '@/lib/transit/contracts';
import { buildTimelineItems, getModePresentation } from '@/lib/transit/presentation';
import TransitStopLabel from './TransitStopLabel';

const modeIcons = {
  bus: Bus,
  'cable-car': CableCar,
  footprints: Footprints,
  ship: Ship,
  'train-front': TrainFront,
  'train-track': TrainTrack,
  'tram-front': TramFront,
  van: Van,
};

export default function TransitItinerary({ itinerary, compact }: { itinerary: Itinerary; compact: boolean }) {
  const items = buildTimelineItems(itinerary);

  return (
    <ol
      role="list"
      aria-label="Rota adımları"
      className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-3' : 'p-4'}`}
    >
      {items.map((item) => {
        const mode = getModePresentation(item.mode);
        const Icon = modeIcons[mode.icon];

        return (
          <li
            key={`${item.stepIndex}-${item.kind}`}
            className={`relative flex items-start gap-3 before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-gray-200 last:pb-0 last:before:hidden ${compact ? 'pb-2' : 'pb-3'}`}
          >
            <span
              aria-hidden="true"
              className="relative grid size-7 shrink-0 place-items-center rounded-full border bg-white text-gray-800"
              style={{ borderColor: mode.color }}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-snug text-gray-900 wrap-break-word">
                {item.kind === 'walk' ? item.instruction : (
                  <>
                    {item.kind === 'board' && (
                      <>
                        <span className="inline-block rounded-md bg-gray-100 px-1.5 font-bold">{item.lineCode}</span>{' '}
                        {item.vehicle}{' '}
                      </>
                    )}
                    <TransitStopLabel {...item.stop} />{' '}{item.action}
                  </>
                )}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-gray-600 tabular-nums">
                <time dateTime={item.time}>{item.time}</time>
                {item.kind !== 'walk' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{item.kind === 'board' ? item.stopCountLabel : mode.label}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
