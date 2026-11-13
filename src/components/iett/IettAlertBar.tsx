'use client';

import Link from 'next/link';
import { AlertTriangle, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { IETTDuyuru } from '@/types/iett';
import {
  buildIettLineHref,
  extractIettAlertTime,
  parseIettAlertList,
  summarizeIettAlertMessage,
} from './alert-presentation';

const rotationMs = 6_000;

export default function IettAlertBar() {
  const [alerts, setAlerts] = useState<IETTDuyuru[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

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
        // Alerts are an enhancement; a failure must not leave an empty banner behind.
      }
    }

    void loadAlerts();
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (paused || alerts.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % alerts.length);
    }, rotationMs);
    return () => window.clearInterval(timer);
  }, [alerts.length, paused]);

  if (alerts.length === 0) return null;

  const active = alerts[activeIndex % alerts.length];
  const lineHref = buildIettLineHref(active.HATKODU);
  const time = extractIettAlertTime(active.GUNCELLEME_SAATI);

  return (
    <aside
      aria-label="Güncel İETT uyarıları"
      className="border-b border-white/10 bg-brand-dark-blue text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="container mx-auto flex min-h-9 items-center gap-2 px-4 py-1.5 text-xs sm:gap-3">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-orange px-2 py-0.5 font-semibold">
          <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
          Uyarı
        </span>

        {time && (
          <span className="hidden shrink-0 items-center gap-1 text-white/70 sm:inline-flex">
            <Clock3 aria-hidden className="h-3.5 w-3.5" />
            {time}
          </span>
        )}

        {lineHref && (
          <Link
            href={lineHref}
            className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-bold text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {active.HATKODU}
          </Link>
        )}

        <span aria-live="off" className="min-w-0 flex-1 truncate text-white/90">
          {summarizeIettAlertMessage(active.MESAJ)}
        </span>

        {alerts.length > 1 && (
          <span className="hidden shrink-0 items-center gap-1 sm:flex" aria-label={`${activeIndex + 1} / ${alerts.length}`}>
            {alerts.map((alert, index) => (
              <button
                key={`${alert.HATKODU}-${alert.GUNCELLEME_SAATI}-${index}`}
                type="button"
                aria-label={`${index + 1}. uyarıyı göster`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex ? 'w-4 bg-brand-orange' : 'w-1.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </span>
        )}
      </div>
    </aside>
  );
}
