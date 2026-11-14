'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BusFront, Clock3, Loader2, Search, TrainFront } from 'lucide-react';
import {
  filterTransitAlerts,
  formatTransitAlertDateTime,
  getTransitAlertCounts,
  normalizeTransitAlerts,
  type TransitAlert,
  type TransitAlertFilter,
  type TransitAlertSource,
} from '@/lib/transit/alerts';

const filters = [
  { value: 'all', label: 'Tümü', icon: AlertTriangle },
  { value: 'bus', label: 'Otobüs', icon: BusFront },
  { value: 'metro', label: 'Metro', icon: TrainFront },
] as const;

function sourceLabel(source: TransitAlertSource): string {
  return source === 'iett' ? 'İETT' : 'Metro İstanbul';
}

function AlertCard({ alert }: { alert: TransitAlert }) {
  const formattedDateTime = formatTransitAlertDateTime(alert.updatedAt) || alert.updatedAt;
  const content = (
    <article className="h-full rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50/30">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-bold ${alert.mode === 'bus'
          ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
          {sourceLabel(alert.source)}
        </span>
        {alert.lineCode && <span className="rounded-full bg-gray-100 px-2 py-1 font-bold text-brand-dark-blue">{alert.lineCode}</span>}
        <time dateTime={alert.updatedAt} className="ml-auto inline-flex items-center gap-1 text-gray-500">
          <Clock3 aria-hidden className="size-3.5" />
          {formattedDateTime}
        </time>
      </div>
      <h2 className="text-base font-bold leading-6 text-brand-dark-blue">{alert.title}</h2>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-gray-700">{alert.message}</p>
    </article>
  );
  if (!alert.href) return content;
  if (alert.external) {
    return (
      <a href={alert.href} target="_blank" rel="nofollow noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }
  return <Link href={alert.href} className="block h-full">{content}</Link>;
}

export default function UlasimDurumuClient() {
  const [alerts, setAlerts] = useState<TransitAlert[]>([]);
  const [filter, setFilter] = useState<TransitAlertFilter['mode']>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [failedSources, setFailedSources] = useState<TransitAlertSource[]>([]);

  useEffect(() => {
    const abort = new AbortController();
    async function fetchJson(path: string) {
      const response = await fetch(path, { cache: 'no-store', signal: abort.signal });
      if (!response.ok) throw new Error('Transit data unavailable');
      return response.json();
    }
    void Promise.allSettled([
      fetchJson('/api/iett/duyurular'),
      fetchJson('/api/metro/duyurular'),
      fetchJson('/api/iett/hatlar'),
      fetchJson('/api/metro'),
    ]).then(([iett, metro, iettLines, metroLines]) => {
      if (abort.signal.aborted) return;
      const failures: TransitAlertSource[] = [];
      if (iett.status === 'rejected') failures.push('iett');
      if (metro.status === 'rejected') failures.push('metro');
      setFailedSources(failures);
      setAlerts(normalizeTransitAlerts({
        ...(iett.status === 'fulfilled' ? { iett: iett.value } : {}),
        ...(metro.status === 'fulfilled' ? { metro: metro.value } : {}),
        ...(iettLines.status === 'fulfilled' ? { iettLines: iettLines.value } : {}),
        ...(metroLines.status === 'fulfilled' ? { metroLines: metroLines.value } : {}),
      }));
      setLoading(false);
    });
    return () => abort.abort();
  }, []);

  const visibleAlerts = useMemo(
    () => filterTransitAlerts(alerts, { mode: filter, query }),
    [alerts, filter, query],
  );
  const counts = useMemo(() => getTransitAlertCounts(alerts), [alerts]);

  return (
    <section aria-label="Güncel ulaşım uyarıları" className="grid gap-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Ulaşım türü" className="flex flex-wrap gap-2">
            {filters.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${filter === value
                  ? 'border-brand-orange bg-brand-orange text-white'
                  : 'border-gray-200 bg-white text-brand-dark-blue hover:bg-gray-50'}`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
                <span className="rounded-full bg-black/10 px-1.5 text-xs">{counts[value]}</span>
              </button>
            ))}
          </div>
          <label className="relative block min-w-0 sm:w-72">
            <span className="sr-only">Hat veya uyarı ara</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hat veya uyarı ara"
              className="min-h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-soft-blue focus:ring-2 focus:ring-brand-light-blue"
            />
          </label>
        </div>
      </div>

      {failedSources.length > 0 && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {failedSources.map(sourceLabel).join(' ve ')} uyarıları geçici olarak alınamadı. Kullanılabilen kaynaklar gösteriliyor.
        </p>
      )}

      {loading ? (
        <div className="grid min-h-40 place-items-center text-sm text-gray-500">
          <span className="inline-flex items-center gap-2"><Loader2 aria-hidden className="size-5 animate-spin" /> Uyarılar yükleniyor…</span>
        </div>
      ) : visibleAlerts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-12 text-center">
          <AlertTriangle aria-hidden className="mx-auto mb-3 size-8 text-gray-400" />
          <p className="font-semibold text-brand-dark-blue">Bu filtreye uygun aktif uyarı bulunmuyor.</p>
          <p className="mt-1 text-sm text-gray-500">Başka bir hat arayabilir veya tüm ulaşım türlerini gösterebilirsiniz.</p>
        </div>
      )}
    </section>
  );
}
