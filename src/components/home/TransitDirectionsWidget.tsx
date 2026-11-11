import { Navigation } from 'lucide-react';
import Link from 'next/link';
import TransitPlanner from '@/components/transit/TransitPlanner';

export default function TransitDirectionsWidget() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-none p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Navigation aria-hidden="true" className="w-5 h-5 text-brand-orange" />
          <h2 className="font-bold text-sm text-gray-900">Yol Tarifi</h2>
        </div>
        <Link href="/yol-tarifi" className="text-xs text-brand-soft-blue hover:underline">
          Detaylı arama →
        </Link>
      </div>
      <TransitPlanner variant="home" />
    </div>
  );
}
