import { BusFront, Footprints, Route, TrainFront, type LucideIcon } from 'lucide-react';
import type { RoutePreference, RouteTravelMode } from '@/lib/transit/contracts';

interface TransitPlannerOptionsProps {
  compact: boolean;
  preference: RoutePreference;
  travelMode: RouteTravelMode;
  onPreferenceChange: (value: RoutePreference) => void;
  onTravelModeChange: (value: RouteTravelMode) => void;
}

const preferences = [
  { value: 'fastest', label: 'En hızlı' },
  { value: 'less-walking', label: 'Daha az yürüme' },
  { value: 'fewer-transfers', label: 'Daha az aktarma' },
] as const satisfies readonly { value: RoutePreference; label: string }[];

const inputClass = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-soft-blue';

const travelModes = [
  { value: 'transit', label: 'Toplu taşıma', icon: Route },
  { value: 'walking', label: 'Yürüyerek', icon: Footprints },
  { value: 'bus', label: 'Otobüs', icon: BusFront },
  { value: 'metro', label: 'Metro', icon: TrainFront },
] as const satisfies readonly { value: RouteTravelMode; label: string; icon: LucideIcon }[];

export default function TransitPlannerOptions({
  compact, preference, travelMode, onPreferenceChange, onTravelModeChange,
}: TransitPlannerOptionsProps) {
  const preferenceControl = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 gap-1 text-sm font-semibold text-gray-800">
        Rota tercihi
        <select
          className={inputClass}
          value={preference}
          onChange={(event) => {
            const option = preferences.find(({ value }) => value === event.target.value);
            if (option) onPreferenceChange(option.value);
          }}
        >
          {preferences.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <div className="grid gap-3">
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold text-gray-800">Ulaşım türü</legend>
        <div className="flex flex-wrap gap-2">
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
      </fieldset>
      {compact ? (
        <details className="rounded-xl border border-gray-200 px-3 open:pb-3">
          <summary className="cursor-pointer py-2 text-sm font-medium text-brand-soft-blue focus-visible:outline-2 focus-visible:outline-brand-soft-blue">
            Rota tercihi
          </summary>
          {preferenceControl}
        </details>
      ) : preferenceControl}
    </div>
  );
}
