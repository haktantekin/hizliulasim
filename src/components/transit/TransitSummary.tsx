import type { TransitItinerary } from '@/lib/transit/contracts';
import { getItinerarySummary } from '@/lib/transit/presentation';

export default function TransitSummary({ itinerary }: { itinerary: TransitItinerary }) {
  const { duration, walking, transfers, departureTime, arrivalTime } = getItinerarySummary(itinerary);

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
    </span>
  );
}
