import type { RoutePreference } from '@/lib/transit/contracts';

interface TransitPlannerOptionsProps {
  compact: boolean;
  departureAt: string;
  preference: RoutePreference;
  onDepartureChange: (value: string) => void;
  onPreferenceChange: (value: RoutePreference) => void;
}

const preferences = [
  { value: 'fastest', label: 'En hızlı' },
  { value: 'less-walking', label: 'Daha az yürüme' },
  { value: 'fewer-transfers', label: 'Daha az aktarma' },
] as const satisfies readonly { value: RoutePreference; label: string }[];

const istanbulOffsetMs = 3 * 60 * 60 * 1000;
const inputClass = 'min-h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-soft-blue';

export default function TransitPlannerOptions({
  compact, departureAt, preference, onDepartureChange, onPreferenceChange,
}: TransitPlannerOptionsProps) {
  const timestamp = Date.parse(departureAt);
  const localDeparture = Number.isFinite(timestamp) ? new Date(timestamp + istanbulOffsetMs).toISOString().slice(0, 16) : '';
  const controls = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-0 gap-1 text-sm font-semibold text-gray-800">
          Kalkış zamanı (İstanbul)
          <input
            type="datetime-local"
            className={inputClass}
            value={localDeparture}
            onChange={(event) => {
              const value = event.target.value;
              const time = Date.parse(`${value}+03:00`);
              if (!value || Number.isFinite(time)) onDepartureChange(value ? new Date(time).toISOString() : '');
            }}
          />
        </label>
        <button
          type="button"
          aria-pressed={!departureAt}
          onClick={() => onDepartureChange('')}
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm text-brand-soft-blue hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-soft-blue aria-pressed:border-brand-soft-blue aria-pressed:bg-brand-light-blue/40"
        >
          Şimdi
        </button>
      </div>
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
