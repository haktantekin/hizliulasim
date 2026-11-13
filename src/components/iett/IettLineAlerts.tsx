'use client';

import { AlertTriangle, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { IETTDuyuru } from '@/types/iett';
import {
  buildIettLineAlertsEndpoint,
  extractIettAlertTime,
  parseIettAlertList,
} from './alert-presentation';

export default function IettLineAlerts({ lineCode }: { lineCode: string }) {
  const [result, setResult] = useState<{ lineCode: string; alerts: IETTDuyuru[] } | null>(null);
  const alerts = result?.lineCode === lineCode ? result.alerts : [];

  useEffect(() => {
    const endpoint = buildIettLineAlertsEndpoint(lineCode);
    if (endpoint === null) return;
    const alertsEndpoint = endpoint;
    const abort = new AbortController();

    async function loadAlerts() {
      try {
        const response = await fetch(alertsEndpoint, { cache: 'no-store', signal: abort.signal });
        if (!response.ok) return;
        const parsed = parseIettAlertList(await response.json());
        if (parsed !== null) setResult({ lineCode, alerts: parsed });
      } catch {
        // Line details stay usable when the optional live alert feed is unavailable.
      }
    }

    void loadAlerts();
    return () => abort.abort();
  }, [lineCode]);

  if (alerts.length === 0) return null;

  return (
    <section aria-labelledby="iett-line-alerts-title" className="overflow-hidden rounded-xl border border-orange-200 bg-orange-50/70">
      <div className="flex items-center gap-2 border-b border-orange-200 bg-orange-100/70 px-4 py-3 text-brand-dark-blue">
        <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-brand-orange" />
        <h2 id="iett-line-alerts-title" className="text-sm font-bold">
          {lineCode} hattında güncel uyarı
        </h2>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-orange">
          {alerts.length}
        </span>
      </div>

      <div className="divide-y divide-orange-200/80">
        {alerts.map((alert, index) => {
          const time = extractIettAlertTime(alert.GUNCELLEME_SAATI);
          return (
            <article key={`${alert.GUNCELLEME_SAATI}-${index}`} className="px-4 py-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-brand-orange">{alert.TIP}</span>
                {time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock3 aria-hidden className="h-3.5 w-3.5" />
                    {time}
                  </span>
                )}
              </div>
              <p className="text-sm leading-6 text-gray-800">{alert.MESAJ}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
