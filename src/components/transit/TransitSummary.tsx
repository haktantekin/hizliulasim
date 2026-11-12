import { Bus, CableCar, Footprints, Ship, TrainFront, TrainTrack, TramFront, Van } from 'lucide-react';
import type { TransitItinerary } from '@/lib/transit/contracts';
import { getItinerarySummary, getModePresentation, getUsedTransitModes } from '@/lib/transit/presentation';

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

export default function TransitSummary({ itinerary }: { itinerary: TransitItinerary }) {
  const { duration, walking, transfers, departureTime, arrivalTime } = getItinerarySummary(itinerary);
  const usedModes = getUsedTransitModes(itinerary);

  return (
    <span className="grid gap-1 text-sm text-gray-700">
      <span className="flex flex-wrap items-baseline gap-x-2">
        <strong className="text-base text-gray-900">{duration}</strong>
        <span className="whitespace-nowrap tabular-nums">
          <span className="sr-only">Kalkış </span><time dateTime={departureTime}>{departureTime}</time>
          <span aria-hidden="true"> → </span>
          <span className="sr-only"> Varış </span><time dateTime={arrivalTime}>{arrivalTime}</time>
        </span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span>{walking}</span><span aria-hidden="true">·</span><span>{transfers}</span>
      </span>
      {usedModes.length > 0 && (
        <span className="mt-1 flex flex-wrap gap-1.5" aria-label="Rotada kullanılan ulaşım türleri">
          {usedModes.map((usedMode) => {
            const mode = getModePresentation(usedMode);
            const Icon = modeIcons[mode.icon];
            return (
              <span
                key={usedMode}
                className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs font-medium"
                style={{ borderColor: mode.color, color: mode.color }}
              >
                <Icon aria-hidden="true" className="size-3" />
                {mode.label}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}
