import { Check } from 'lucide-react';
import type { TransitItinerary } from '@/lib/transit/contracts';
import TransitSummary from './TransitSummary';

interface TransitAlternativesProps {
  alternatives: readonly TransitItinerary[];
  selectedAlternative: number;
  onSelect: (index: number) => void;
}

export default function TransitAlternatives({ alternatives, selectedAlternative, onSelect }: TransitAlternativesProps) {
  return (
    <div role="group" aria-label="Rota alternatifleri" className="flex flex-wrap gap-2">
      {alternatives.map((itinerary, index) => {
        const selected = index === selectedAlternative;

        return (
          <button
            key={index}
            type="button"
            aria-current={selected ? true : undefined}
            onClick={() => onSelect(index)}
            className="min-h-11 min-w-0 flex-1 basis-40 rounded-xl border border-gray-200 bg-white p-3 text-start hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue aria-current:border-brand-soft-blue aria-current:bg-brand-light-blue/30"
          >
            <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-brand-soft-blue">
              {index + 1}. rota
              {selected && <Check aria-hidden="true" className="size-4 shrink-0" />}
            </span>
            <TransitSummary itinerary={itinerary} />
          </button>
        );
      })}
    </div>
  );
}
