'use client';

import dynamic from 'next/dynamic';
import type { TransitRouteMapProps } from './TransitRouteMap';

const statusClass = 'grid h-full place-items-center rounded-xl bg-gray-100 text-sm text-gray-600';

const TransitRouteMap = dynamic<TransitRouteMapProps>(
  () => import('./TransitRouteMap').catch(() => ({
    default: function UnavailableRouteMap() {
      return <p role="status" className={statusClass}>Harita yüklenemedi.</p>;
    },
  })),
  {
    ssr: false,
    loading: () => (
      <p role="status" className={statusClass}>Harita yükleniyor…</p>
    ),
  },
);

export default function TransitRouteMapLoader(props: TransitRouteMapProps) {
  const height = props.size === 'compact' ? 'h-60 sm:h-72' : 'h-[22rem] md:h-[30rem]';
  return (
    <div className={`${height} min-w-0`}>
      <TransitRouteMap {...props} />
    </div>
  );
}
