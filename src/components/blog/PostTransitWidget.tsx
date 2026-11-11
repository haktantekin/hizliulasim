import { Navigation } from 'lucide-react';
import TransitPlanner from '@/components/transit/TransitPlanner';

interface PostTransitWidgetProps {
  postTitle: string;
  destination: { latitude: number; longitude: number };
}

export default function PostTransitWidget({ postTitle, destination }: PostTransitWidgetProps) {
  return (
    <section className="mb-6 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Navigation aria-hidden="true" className="size-5 text-brand-orange" />
        <h2 className="text-sm font-bold text-gray-900">Yol Tarifi</h2>
      </div>
      <TransitPlanner variant="detail" fixedDestination={{ ...destination, name: postTitle }} />
    </section>
  );
}
