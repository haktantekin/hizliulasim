import { BusFront, Footprints, Route, TrainFront, type LucideIcon } from 'lucide-react';
import type { RouteTravelMode } from '@/lib/transit/contracts';

interface TransitPlannerOptionsProps {
  travelMode: RouteTravelMode;
  onTravelModeChange: (value: RouteTravelMode) => void;
}

const travelModes = [
  { value: 'transit', label: 'Toplu taşıma', icon: Route },
  { value: 'walking', label: 'Yürüyerek', icon: Footprints },
  { value: 'bus', label: 'Otobüs', icon: BusFront },
  { value: 'metro', label: 'Metro', icon: TrainFront },
] as const satisfies readonly { value: RouteTravelMode; label: string; icon: LucideIcon }[];

export default function TransitPlannerOptions({
  travelMode, onTravelModeChange,
}: TransitPlannerOptionsProps) {
  return (
    <div role="group" aria-label="Ulaşım türü" className="flex flex-wrap gap-2">
      {travelModes.map(({ value, label, icon: Icon }) => {
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
            {label}
          </button>
        );
      })}
    </div>
  );
}
