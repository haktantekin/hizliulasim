import { BusFront, Footprints, Route, TrainFront, type LucideIcon } from 'lucide-react';
import type { RouteTravelMode } from '@/lib/transit/contracts';
import { getTravelModeLabel } from '@/lib/transit/presentation';

interface TransitPlannerOptionsProps {
  travelMode: RouteTravelMode;
  onTravelModeChange: (value: RouteTravelMode) => void;
}

const travelModes = [
  { value: 'transit', icon: Route },
  { value: 'walking', icon: Footprints },
  { value: 'bus', icon: BusFront },
  { value: 'metro', icon: TrainFront },
] as const satisfies readonly { value: RouteTravelMode; icon: LucideIcon }[];

export default function TransitPlannerOptions({
  travelMode, onTravelModeChange,
}: TransitPlannerOptionsProps) {
  return (
    <div role="group" aria-label="Ulaşım türü" className="flex flex-wrap gap-2">
      {travelModes.map(({ value, icon: Icon }) => {
        const selected = travelMode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onTravelModeChange(value)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue ${selected
              ? 'border-brand-orange bg-brand-orange text-white'
              : 'border-brand-light-blue bg-white text-brand-dark-blue hover:bg-gray-50'}`}
          >
            <Icon aria-hidden="true" className="size-4" />
            {getTravelModeLabel(value)}
          </button>
        );
      })}
    </div>
  );
}
