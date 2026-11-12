import type { RoutePreference } from '@/lib/transit/contracts';

interface TransitPlannerOptionsProps {
  compact: boolean;
  preference: RoutePreference;
  onPreferenceChange: (value: RoutePreference) => void;
}

const preferences = [
  { value: 'fastest', label: 'En hızlı' },
  { value: 'less-walking', label: 'Daha az yürüme' },
  { value: 'fewer-transfers', label: 'Daha az aktarma' },
] as const satisfies readonly { value: RoutePreference; label: string }[];

const inputClass = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-soft-blue';

export default function TransitPlannerOptions({
  compact, preference, onPreferenceChange,
}: TransitPlannerOptionsProps) {
  const controls = (
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

  return compact ? (
    <details className="rounded-xl border border-gray-200 px-3 open:pb-3">
      <summary className="cursor-pointer py-2 text-sm font-medium text-brand-soft-blue focus-visible:outline-2 focus-visible:outline-brand-soft-blue">
        Rota seçenekleri
      </summary>
      {controls}
    </details>
  ) : controls;
}
