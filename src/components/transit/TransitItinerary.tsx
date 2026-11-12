import { Bus, CableCar, Footprints, MapPin, Ship, TrainFront, TrainTrack, TramFront, Van } from 'lucide-react';
import type { TransitItinerary as Itinerary, TransitProviderCoverage } from '@/lib/transit/contracts';
import { buildTimelineItems, getModePresentation, getTransitCoverageNotice } from '@/lib/transit/presentation';
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

interface TransitItineraryProps {
  itinerary: Itinerary;
  compact: boolean;
  selectedStep: number | null;
  onSelectStep: (index: number) => void;
  providerCoverage?: readonly TransitProviderCoverage[];
}

export default function TransitItinerary({
  itinerary, compact, selectedStep, onSelectStep, providerCoverage,
}: TransitItineraryProps) {
  const items = buildTimelineItems(itinerary);
  const coverageNotice = getTransitCoverageNotice(itinerary, providerCoverage);

  return (
    <div className="grid gap-2">
      <ol
        role="list"
        aria-label="Rota adımları"
        className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-3' : 'p-4'}`}
      >
      {items.map((item) => {
        const mode = getModePresentation(item.mode);
        const Icon = modeIcons[mode.icon];
        const selected = item.stepIndex === selectedStep;
        const stopAction = item.kind === 'walk' ? item.instruction
          : `${item.stop.name} ${item.kind === 'board' ? 'biniş' : 'iniş'}`;

        return (
          <li
            key={`${item.stepIndex}-${item.kind}`}
            className={`relative flex items-start gap-3 rounded-lg before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-gray-200 last:pb-0 last:before:hidden ${compact ? 'pb-2' : 'pb-3'} ${selected ? 'bg-brand-light-blue/25' : ''}`}
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
            <button
              type="button"
              aria-label={`${item.stepIndex + 1}. etabı haritada göster, ${stopAction}`}
              aria-pressed={selected}
              title={selected ? 'Tüm rotayı göster' : 'Haritada göster'}
              onClick={() => onSelectStep(item.stepIndex)}
              className="ml-auto inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-brand-soft-blue hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue aria-pressed:bg-brand-soft-blue aria-pressed:text-white"
            >
              <MapPin aria-hidden="true" className="size-4" />
              {!compact && <span className="hidden sm:inline">{selected ? 'Tüm rota' : 'Haritada göster'}</span>}
            </button>
          </li>
        );
      })}
      </ol>
      {coverageNotice && (
        <p className="px-1 text-xs leading-relaxed text-gray-600">{coverageNotice}</p>
      )}
    </div>
  );
}
