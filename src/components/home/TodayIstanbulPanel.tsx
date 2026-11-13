'use client';

import Link from 'next/link';
import { Activity, CloudSun, MapPin, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import type { DailyRecommendationsResponse } from '@/lib/recommendations/contracts';
import DailyRecommendations from './DailyRecommendations';
import {
  createLatestRequestController,
  buildDailyRecommendationPlaceholderSlots,
  buildDailySummarySlots,
  initialDailyRecommendationsState,
  parseActiveAlertCount,
  parseActiveAlertTotal,
  parseDailyRecommendationsResponse,
  parseTrafficSummary,
  reduceDailyRecommendationsState,
  shouldAutoRefreshForPermission,
} from './daily-recommendations-state';

interface SummaryState {
  traffic: { index: number; label: string } | null;
  trafficLoaded: boolean;
  alertCount: number | null;
  alertsLoaded: boolean;
}

function temperatureLabel(data: DailyRecommendationsResponse | null): string | null {
  const temperature = data?.context.weather?.temperatureC;
  return typeof temperature === 'number' ? `${Math.round(temperature)}°` : null;
}

const summaryPresentation: Record<'weather' | 'traffic' | 'alerts', { label: string; icon: LucideIcon; iconClass: string }> = {
  weather: { label: 'Hava', icon: CloudSun, iconClass: 'text-sky-500' },
  traffic: { label: 'Trafik', icon: Activity, iconClass: 'text-amber-500' },
  alerts: { label: 'Ulaşım uyarısı', icon: TriangleAlert, iconClass: 'text-brand-orange' },
};

function SummaryPlaceholder({ metric }: { metric: keyof typeof summaryPresentation }) {
  const { label, icon: Icon, iconClass } = summaryPresentation[metric];
  return (
    <div aria-label={`${label} yükleniyor`} className="min-h-[76px] rounded-xl border border-white bg-white/90 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
        <Icon aria-hidden className={`h-4 w-4 ${iconClass}`} /> {label}
      </div>
      <div aria-hidden className="mt-2 h-5 w-24 animate-pulse rounded bg-slate-200" />
    </div>
  );
}

function SummaryUnavailable({ metric }: { metric: keyof typeof summaryPresentation }) {
  const { label, icon: Icon, iconClass } = summaryPresentation[metric];
  return (
    <div className="min-h-[76px] rounded-xl border border-white bg-white/90 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
        <Icon aria-hidden className={`h-4 w-4 ${iconClass}`} /> {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-400">Şu an alınamıyor</p>
    </div>
  );
}

function RecommendationLoadingSkeleton({ slots }: { slots: Array<'best' | 'nearby' | 'free'> }) {
  return (
    <div role="status" aria-label="Bugünün önerileri yükleniyor" className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {slots.map((slot) => (
        <article key={slot} className="min-h-[360px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="h-32 animate-pulse bg-gradient-to-br from-blue-50 to-orange-50" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-11 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded bg-slate-100" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
        </article>
      ))}
      <span className="sr-only">Bugünün önerileri hazırlanıyor.</span>
    </div>
  );
}

export default function TodayIstanbulPanel() {
  const [state, dispatch] = useReducer(reduceDailyRecommendationsState, initialDailyRecommendationsState);
  const [summary, setSummary] = useState<SummaryState>({
    traffic: null,
    trafficLoaded: false,
    alertCount: null,
    alertsLoaded: false,
  });
  const requests = useRef<ReturnType<typeof createLatestRequestController> | null>(null);
  if (requests.current === null) requests.current = createLatestRequestController();

  const loadRecommendations = useCallback(async (location?: GeolocationCoordinates) => {
    dispatch({ type: location ? 'location-start' : 'load-start' });
    const signal = requests.current?.start();
    const params = location
      ? new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude) })
      : null;
    try {
      const response = await fetch(`/api/recommendations/today${params ? `?${params}` : ''}`, {
        cache: 'no-store',
        signal,
      });
      if (!response.ok) throw new Error('Recommendations unavailable');
      const parsed = parseDailyRecommendationsResponse(await response.json());
      if (!parsed) throw new Error('Invalid recommendations');
      if (!signal?.aborted) dispatch({ type: 'load-success', payload: parsed });
    } catch {
      if (!signal?.aborted) dispatch({ type: 'load-failure' });
    }
  }, []);

  const locateAndRefresh = useCallback(() => {
    if (!navigator.geolocation) {
      dispatch({ type: 'location-denied' });
      return;
    }
    dispatch({ type: 'location-start' });
    navigator.geolocation.getCurrentPosition(
      (position) => void loadRecommendations(position.coords),
      () => dispatch({ type: 'location-denied' }),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 10 * 60 * 1_000 },
    );
  }, [loadRecommendations]);

  useEffect(() => {
    void loadRecommendations();
    return () => requests.current?.dispose();
  }, [loadRecommendations]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadTraffic() {
      let traffic: SummaryState['traffic'] = null;
      try {
        const response = await fetch('/api/traffic', { signal: controller.signal });
        if (response.ok) traffic = parseTrafficSummary(await response.json());
      } catch {
        // Traffic is an optional, independently rendered summary metric.
      }
      if (!controller.signal.aborted) {
        setSummary((current) => ({ ...current, traffic, trafficLoaded: true }));
      }
    }
    async function loadAlerts() {
      let alertCount: number | null = null;
      try {
        const response = await fetch('/api/iett/duyurular?limit=1', { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const body: unknown = await response.json();
          alertCount = parseActiveAlertTotal(response.headers.get('x-hizliulasim-alert-total'))
            ?? parseActiveAlertCount(body);
        }
      } catch {
        // Alerts are an optional, independently rendered summary metric.
      }
      if (!controller.signal.aborted) {
        setSummary((current) => ({ ...current, alertCount, alertsLoaded: true }));
      }
    }
    void loadTraffic();
    void loadAlerts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let active = true;
    void navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (active && shouldAutoRefreshForPermission(permission.state)) locateAndRefresh();
    }).catch(() => undefined);
    return () => { active = false; };
  }, [locateAndRefresh]);

  const weather = state.data?.context.weather ?? null;
  const weatherTemperature = temperatureLabel(state.data);
  const loading = (state.status === 'idle' || state.status === 'loading') && !state.data;
  const summarySlots = buildDailySummarySlots({
    weather: { loaded: !loading, available: weather !== null },
    traffic: { loaded: summary.trafficLoaded, available: summary.traffic !== null },
    alerts: { loaded: summary.alertsLoaded, available: summary.alertCount !== null },
  });
  const recommendationPlaceholders = buildDailyRecommendationPlaceholderSlots(loading);

  return (
    <section aria-labelledby="today-istanbul-title" className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-slate-50 via-white to-orange-50 shadow-sm">
      <div className="border-b border-blue-100/80 px-4 py-4 md:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark-blue text-white">
            <MapPin aria-hidden className="h-4 w-4" />
          </span>
          <div>
            <h2 id="today-istanbul-title" className="text-lg font-bold text-brand-soft-blue">Bugün İstanbul</h2>
            <p className="text-xs text-gray-500">Günün koşulları ve sana uygun şehir önerileri</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {summarySlots.map((slot) => {
            if (slot.status === 'loading') return <SummaryPlaceholder key={slot.key} metric={slot.key} />;
            if (slot.status === 'unavailable') return <SummaryUnavailable key={slot.key} metric={slot.key} />;
            if (slot.key === 'weather' && weather) {
              return (
                <div key={slot.key} className="min-h-[76px] rounded-xl border border-white bg-white/90 p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <CloudSun aria-hidden className="h-4 w-4 text-sky-500" /> Hava
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900">{weather.summary}{weatherTemperature ? ` · ${weatherTemperature}` : ''}</p>
                </div>
              );
            }
            if (slot.key === 'traffic' && summary.traffic) {
              return (
                <div key={slot.key} className="min-h-[76px] rounded-xl border border-white bg-white/90 p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <Activity aria-hidden className="h-4 w-4 text-amber-500" /> Trafik
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900">{summary.traffic.label} · {summary.traffic.index}/100</p>
                </div>
              );
            }
            if (slot.key === 'alerts' && summary.alertCount !== null) {
              return (
                <Link
                  key={slot.key}
                  href="/ulasim-durumu"
                  className="min-h-[76px] rounded-xl border border-white bg-white/90 p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-orange"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <TriangleAlert aria-hidden className="h-4 w-4 text-brand-orange" /> Ulaşım uyarısı
                  </div>
                  <p className="mt-2 text-sm font-bold text-gray-900">{summary.alertCount > 0 ? `${summary.alertCount} aktif duyuru` : 'Aktif duyuru yok'}</p>
                </Link>
              );
            }
            return <SummaryUnavailable key={slot.key} metric={slot.key} />;
          })}
        </div>
      </div>

      <div className="px-4 py-4 md:px-5 md:py-5">
        {loading ? (
          <RecommendationLoadingSkeleton slots={recommendationPlaceholders} />
        ) : (
            <DailyRecommendations
              data={state.data}
              status={state.status}
              notice={state.notice}
              onLocate={locateAndRefresh}
            />
        )}
      </div>
    </section>
  );
}
