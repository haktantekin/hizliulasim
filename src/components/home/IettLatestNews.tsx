'use client';

import Link from 'next/link';
import { BusFront, CalendarDays, ExternalLink, Newspaper } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { IETTDuyuru } from '@/types/iett';
import {
  buildIettAlertDestination,
  parseIettAlertList,
  summarizeIettAlertMessage,
} from '@/components/iett/alert-presentation';

function NewsCard({ alert }: { alert: IETTDuyuru }) {
  const destination = buildIettAlertDestination(alert);
  const card: ReactNode = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-[11px] font-bold text-brand-orange">
          {destination?.external ? <Newspaper className="h-3.5 w-3.5" /> : <BusFront className="h-3.5 w-3.5" />}
          {destination?.external ? 'İETT' : alert.HATKODU}
        </span>
        {destination?.external && <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-gray-400" />}
      </div>
      <h3 className="mt-3 line-clamp-3 min-h-[3.75rem] text-sm font-semibold leading-5 text-gray-800">
        {summarizeIettAlertMessage(alert.HAT, 150)}
      </h3>
      <p className="mt-3 flex items-center gap-1 text-xs text-gray-400">
        <CalendarDays aria-hidden className="h-3.5 w-3.5" />
        {alert.GUNCELLEME_SAATI}
      </p>
    </>
  );
  const classes = 'min-w-[250px] max-w-[250px] snap-start rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md';

  if (destination?.external) {
    return (
      <a href={destination.href} target="_blank" rel="nofollow noopener noreferrer" className={classes}>
        {card}
      </a>
    );
  }
  if (destination) {
    return <Link href={destination.href} prefetch={false} className={classes}>{card}</Link>;
  }
  return <article className={classes}>{card}</article>;
}

export default function IettLatestNews() {
  const [alerts, setAlerts] = useState<IETTDuyuru[]>([]);

  useEffect(() => {
    const abort = new AbortController();
    async function loadAlerts() {
      try {
        const response = await fetch('/api/iett/duyurular?limit=5', {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (!response.ok) return;
        const parsed = parseIettAlertList(await response.json());
        if (parsed !== null) setAlerts(parsed);
      } catch {
        // The homepage remains usable when the optional announcement feed is unavailable.
      }
    }
    void loadAlerts();
    return () => abort.abort();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <section aria-labelledby="iett-latest-news-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="iett-latest-news-title" className="text-lg font-bold text-brand-soft-blue">
          İETT Son Duyurular
        </h2>
        <span className="text-xs font-medium text-gray-400">Son {alerts.length} duyuru</span>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {alerts.map((alert, index) => (
          <NewsCard key={`${alert.HATKODU}-${alert.GUNCELLEME_SAATI}-${index}`} alert={alert} />
        ))}
      </div>
    </section>
  );
}
