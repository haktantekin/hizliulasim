'use client';

import dynamic from 'next/dynamic';
import { Bus, ExternalLink, Loader2, MapPin, RefreshCw, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAppSelector } from '@/store/hooks';
import type { IETTDurakDetay, IETTHatOtoKonum } from '@/types/iett';
import { getIettLiveVehicleDirection } from '@/lib/iett-live-direction';
import AuthModal from '@/components/ui/AuthModal';
import LiveFeatureLoginPrompt from './LiveFeatureLoginPrompt';

const LIVE_REFRESH_MS = 60_000;

const LiveVehicleMap = dynamic(() => import('./LiveVehicleMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[350px] w-full animate-pulse items-center justify-center rounded-xl bg-gray-100 md:h-[450px]">
      <Bus className="h-8 w-8 text-gray-300" />
    </div>
  ),
});

interface Props {
  lineCode: string;
  stops: IETTDurakDetay[];
  userLocation:
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'denied' }
    | { status: 'error' }
    | { status: 'active'; lat: number; lng: number };
  onRequestLocation: () => void;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6_371_000;
  const toRadians = (degree: number) => degree * Math.PI / 180;
  const latitudeDelta = toRadians(lat2 - lat1);
  const longitudeDelta = toRadians(lng2 - lng1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.max(1, Math.round(meters))} m`;
  return `${(meters / 1_000).toFixed(1).replace('.', ',')} km`;
}

function closestStop(
  routeStops: readonly IETTDurakDetay[],
  lat: number,
  lng: number,
): { stop: IETTDurakDetay; index: number; distance: number } | null {
  let result: { stop: IETTDurakDetay; index: number; distance: number } | null = null;
  for (let index = 0; index < routeStops.length; index++) {
    const stop = routeStops[index];
    const distance = distanceMeters(lat, lng, stop.YKOORDINATI, stop.XKOORDINATI);
    if (result === null || distance < result.distance) result = { stop, index, distance };
  }
  return result;
}

function stopKey(stop: IETTDurakDetay): string {
  return `${stop.YON}|${stop.DURAKKODU}`;
}

function parseIettTimestamp(value: string): number | null {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const timestamp = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatUpdateTime(timestamp: number | null): string | null {
  if (timestamp === null) return null;
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

export default function LiveVehiclePanel({ lineCode, stops, userLocation, onRequestLocation }: Props) {
  const { isAuthenticated, isLoading: authLoading } = useAppSelector((state) => state.user);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<IETTHatOtoKonum[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessExpired, setAccessExpired] = useState(false);
  const [servedStale, setServedStale] = useState(false);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [manualStopKey, setManualStopKey] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    async function loadVehicles(showSpinner: boolean) {
      let scheduleNext = true;
      controller?.abort();
      controller = new AbortController();
      if (showSpinner) setIsRefreshing(true);

      try {
        const response = await fetch(`/api/iett/konum?hatKodu=${encodeURIComponent(lineCode)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        });

        const body: unknown = await response.json().catch(() => null);
        if (response.status === 401) {
          scheduleNext = false;
          if (!cancelled) {
            setAccessExpired(true);
            setError(null);
          }
          return;
        }
        if (!response.ok || !Array.isArray(body)) {
          const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Canlı araç konumları şu anda alınamıyor.';
          throw new Error(message);
        }

        if (!cancelled) {
          setVehicles(body as IETTHatOtoKonum[]);
          setError(null);
          setAccessExpired(false);
          setServedStale(response.headers.get('X-IETT-Live-Cache') === 'STALE');
          const updatedAt = response.headers.get('X-IETT-Live-Updated-At');
          const parsedUpdatedAt = updatedAt ? Date.parse(updatedAt) : Number.NaN;
          setServerUpdatedAt(Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : Date.now());
        }
      } catch (requestError) {
        if (!cancelled && !(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setError(requestError instanceof Error ? requestError.message : 'Canlı araç konumları şu anda alınamıyor.');
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
          if (scheduleNext) timer = setTimeout(() => void loadVehicles(false), LIVE_REFRESH_MS);
        }
      }
    }

    void loadVehicles(true);

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [authLoading, isAuthenticated, lineCode, refreshKey]);

  const latestVehicleTime = useMemo(() => {
    if (!vehicles) return null;
    let latest: number | null = null;
    for (const vehicle of vehicles) {
      const timestamp = parseIettTimestamp(vehicle.son_konum_zamani || '');
      if (timestamp !== null && (latest === null || timestamp > latest)) latest = timestamp;
    }
    return latest;
  }, [vehicles]);

  const directionGroups = useMemo(() => {
    const groups = new Map<string, IETTDurakDetay[]>();
    for (const stop of stops) {
      const directionStops = groups.get(stop.YON) ?? [];
      if (!directionStops.some((item) => item.DURAKKODU === stop.DURAKKODU)) directionStops.push(stop);
      groups.set(stop.YON, directionStops);
    }
    return Array.from(groups.entries()).map(([direction, directionStops]) => ({
      direction,
      label: vehicles?.find((vehicle) => getIettLiveVehicleDirection(vehicle) === direction)?.yon
        || directionStops[0]?.YON_ADI
        || (direction === 'D' ? 'Gidiş' : direction === 'G' ? 'Dönüş' : direction),
      stops: directionStops.sort((a, b) => a.SIRANO - b.SIRANO),
    }));
  }, [stops, vehicles]);

  const nearestStopKey = useMemo(() => {
    if (userLocation.status !== 'active') return null;
    const candidates = stops.flatMap((stop) => {
      if (!Number.isFinite(stop.YKOORDINATI) || !Number.isFinite(stop.XKOORDINATI)) return [];
      const distance = distanceMeters(userLocation.lat, userLocation.lng, stop.YKOORDINATI, stop.XKOORDINATI);
      const vehiclesAtStop = vehicles?.filter((vehicle) => (
        getIettLiveVehicleDirection(vehicle) === stop.YON
        && Number.isFinite(Number.parseFloat(vehicle.enlem))
        && Number.isFinite(Number.parseFloat(vehicle.boylam))
        && distanceMeters(
          Number.parseFloat(vehicle.enlem),
          Number.parseFloat(vehicle.boylam),
          stop.YKOORDINATI,
          stop.XKOORDINATI,
        ) <= 500
      )).length ?? 0;
      return [{ key: stopKey(stop), distance, vehiclesAtStop }];
    });
    if (candidates.length === 0) return null;

    const minimumDistance = Math.min(...candidates.map((candidate) => candidate.distance));
    return candidates
      .filter((candidate) => candidate.distance <= minimumDistance + 30)
      .sort((a, b) => b.vehiclesAtStop - a.vehiclesAtStop || a.distance - b.distance)[0]?.key ?? null;
  }, [stops, userLocation, vehicles]);

  const selectedStopKey = manualStopKey ?? nearestStopKey ?? '';
  const selectedStop = useMemo(
    () => stops.find((stop) => stopKey(stop) === selectedStopKey) ?? null,
    [selectedStopKey, stops],
  );

  const approachingVehicles = useMemo(() => {
    if (!selectedStop || !vehicles?.length) return [];
    const routeStops = stops
      .filter((stop) => stop.YON === selectedStop.YON)
      .sort((a, b) => a.SIRANO - b.SIRANO);
    const selectedStopIndex = routeStops.findIndex((stop) => stop.DURAKKODU === selectedStop.DURAKKODU);
    if (selectedStopIndex === -1) return [];

    return vehicles
      .flatMap((vehicle) => {
        const direction = getIettLiveVehicleDirection(vehicle);
        if (direction && direction !== selectedStop.YON) return [];
        const lat = Number.parseFloat(vehicle.enlem);
        const lng = Number.parseFloat(vehicle.boylam);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

        const providerStopIndex = routeStops.findIndex((stop) => stop.DURAKKODU === vehicle.yakinDurakKodu);
        const providerStop = providerStopIndex === -1 ? null : routeStops[providerStopIndex];
        const providerStopDistance = providerStop === null
          ? Number.POSITIVE_INFINITY
          : distanceMeters(lat, lng, providerStop.YKOORDINATI, providerStop.XKOORDINATI);
        const nearestGpsStop = closestStop(routeStops, lat, lng);
        const vehicleStopIndex = providerStopIndex !== -1 && providerStopDistance <= 750
          ? providerStopIndex
          : nearestGpsStop?.index ?? -1;

        const stopsAway = selectedStopIndex - vehicleStopIndex;
        if (stopsAway < 0) return [];
        return [{
          vehicle,
          stopsAway,
          distance: distanceMeters(lat, lng, selectedStop.YKOORDINATI, selectedStop.XKOORDINATI),
          updateTime: formatUpdateTime(parseIettTimestamp(vehicle.son_konum_zamani || '')),
        }];
      })
      .sort((a, b) => a.stopsAway - b.stopsAway || a.distance - b.distance);
  }, [selectedStop, stops, vehicles]);

  const activeVehicleRows = useMemo(() => {
    if (!vehicles?.length) return [];
    return vehicles
      .map((vehicle) => {
        const direction = getIettLiveVehicleDirection(vehicle);
        const directionStops = stops
          .filter((stop) => stop.YON === direction)
          .sort((a, b) => a.SIRANO - b.SIRANO);
        const lat = Number.parseFloat(vehicle.enlem);
        const lng = Number.parseFloat(vehicle.boylam);
        const gpsStop = Number.isFinite(lat) && Number.isFinite(lng)
          ? closestStop(directionStops, lat, lng)
          : null;
        const providerStop = directionStops.find((stop) => stop.DURAKKODU === vehicle.yakinDurakKodu) ?? null;
        const providerDistance = providerStop && Number.isFinite(lat) && Number.isFinite(lng)
          ? distanceMeters(lat, lng, providerStop.YKOORDINATI, providerStop.XKOORDINATI)
          : Number.POSITIVE_INFINITY;
        const nearbyStop = providerStop !== null && providerDistance <= 750
          ? providerStop
          : gpsStop?.stop ?? providerStop;
        const nearbyStopDistance = nearbyStop && Number.isFinite(lat) && Number.isFinite(lng)
          ? distanceMeters(lat, lng, nearbyStop.YKOORDINATI, nearbyStop.XKOORDINATI)
          : null;

        const directionGroup = directionGroups.find((group) => group.direction === direction);
        return {
          vehicle,
          direction,
          directionLabel: vehicle.yon || directionGroup?.label || (direction === 'D' ? 'Gidiş' : direction === 'G' ? 'Dönüş' : direction || 'Yön bilgisi yok'),
          nearbyStop,
          nearbyStopDistance,
          updateTime: formatUpdateTime(parseIettTimestamp(vehicle.son_konum_zamani || '')),
        };
      })
      .sort((a, b) => {
        const directionOrder = a.direction.localeCompare(b.direction, 'tr');
        if (directionOrder !== 0) return directionOrder;
        return (a.nearbyStop?.SIRANO ?? Number.MAX_SAFE_INTEGER) - (b.nearbyStop?.SIRANO ?? Number.MAX_SAFE_INTEGER);
      });
  }, [directionGroups, stops, vehicles]);

  if (authLoading) {
    return (
      <div className="flex justify-center rounded-xl border border-gray-200 bg-white py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-soft-blue" />
      </div>
    );
  }

  if (!isAuthenticated || accessExpired) {
    return (
      <>
        <LiveFeatureLoginPrompt onLogin={() => setAuthModalOpen(true)} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => {
            setAuthModalOpen(false);
            if (accessExpired) {
              setAccessExpired(false);
              setRefreshKey((key) => key + 1);
            }
          }}
        />
      </>
    );
  }

  const displayedUpdateTime = formatUpdateTime(latestVehicleTime ?? serverUpdatedAt);

  return (
    <section aria-labelledby="live-vehicles-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-100 bg-green-50/60 px-4 py-3">
        <div>
          <h2 id="live-vehicles-title" className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Bus className="h-4 w-4 text-green-700" />
            {lineCode} Canlı Araç Konumları
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            {vehicles === null
              ? 'Canlı konumlar yükleniyor…'
              : `${vehicles.length} aktif araç${displayedUpdateTime ? ` · Son veri ${displayedUpdateTime}` : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-medium text-green-800 transition-colors hover:bg-green-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yenile
        </button>
      </div>

      {userLocation.status !== 'active' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {userLocation.status === 'loading'
              ? <Loader2 className="h-4 w-4 animate-spin text-brand-soft-blue" />
              : <MapPin className="h-4 w-4 text-brand-soft-blue" />}
            <span>
              {userLocation.status === 'loading'
                ? 'Konumunuz alınıyor…'
                : 'En yakın durağınızı otomatik seçmek için konum izni verin.'}
            </span>
          </div>
          {userLocation.status !== 'loading' && (
            <button
              type="button"
              onClick={onRequestLocation}
              className="rounded-lg bg-brand-soft-blue px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-dark-blue"
            >
              {userLocation.status === 'denied' || userLocation.status === 'error' ? 'Tekrar Dene' : 'Konum İzni Ver'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error} Mevcut güzergâh ve sefer bilgilerini kullanmaya devam edebilirsiniz.</span>
        </div>
      )}

      {servedStale && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          İETT servisine geçici olarak ulaşılamadığı için son başarılı canlı veri gösteriliyor.
        </p>
      )}

      <section aria-labelledby="approaching-vehicles-title" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 bg-gray-50/70 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="approaching-vehicles-title" className="text-sm font-bold text-gray-900">Durağa Yaklaşan Araçlar</h3>
              <p className="mt-1 text-xs text-gray-500">Bir durak seçin; araçları durak sayısı ve konum mesafesine göre görün.</p>
            </div>
            {nearestStopKey && manualStopKey && manualStopKey !== nearestStopKey && (
              <button
                type="button"
                onClick={() => setManualStopKey(null)}
                className="text-xs font-medium text-brand-soft-blue hover:underline"
              >
                Konumuma en yakın durağı seç
              </button>
            )}
          </div>
          <label className="mt-3 block text-xs font-medium text-gray-700" htmlFor="live-stop-select">Durak</label>
          <select
            id="live-stop-select"
            value={selectedStopKey}
            onChange={(event) => setManualStopKey(event.target.value || null)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-soft-blue focus:ring-2 focus:ring-brand-soft-blue/20"
          >
            <option value="">Durak seçin…</option>
            {directionGroups.map((group) => (
              <optgroup key={group.direction} label={group.label}>
                {group.stops.map((stop) => (
                  <option key={stopKey(stop)} value={stopKey(stop)}>
                    {stop.SIRANO}. {stop.DURAKADI} — {group.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selectedStop && nearestStopKey === selectedStopKey && manualStopKey === null && (
            <p className="mt-1.5 text-[11px] text-green-700">
              Konumunuza en yakın durak otomatik seçildi · Yön: {directionGroups.find((group) => group.direction === selectedStop.YON)?.label ?? selectedStop.YON}
            </p>
          )}
          {selectedStop && (nearestStopKey !== selectedStopKey || manualStopKey !== null) && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              Seçili yön: {directionGroups.find((group) => group.direction === selectedStop.YON)?.label ?? selectedStop.YON}
            </p>
          )}
        </div>

        <div className="p-4" aria-live="polite">
          {!selectedStop ? (
            <p className="py-4 text-center text-sm text-gray-500">Araç mesafelerini görmek için bir durak seçin.</p>
          ) : vehicles === null ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-brand-soft-blue" /></div>
          ) : approachingVehicles.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              Şu anda {selectedStop.DURAKADI} durağına yaklaşan aktif araç bulunamadı.
            </p>
          ) : (
            <div className="space-y-2">
              {approachingVehicles.map(({ vehicle, stopsAway, distance, updateTime }) => (
                <div key={`${vehicle.kapino}-${vehicle.guzergahkodu}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <Bus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">Kapı No: {vehicle.kapino}</p>
                      <p className="truncate text-xs text-gray-500">
                        {stopsAway === 0
                          ? (distance <= 300 ? 'Durakta veya durağa çok yakın' : 'GPS’e göre en yakın güzergâh durağı')
                          : `${stopsAway} durak uzakta`}
                        {updateTime ? ` · Son konum ${updateTime}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-soft-blue">{formatDistance(distance)}</p>
                    <p className="text-[10px] text-gray-400">durağa kuş uçuşu</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedStop && (
            <p className="mt-3 text-[11px] leading-4 text-gray-400">
              Durak sayısı aracın GPS konumuna en yakın güzergâh durağına göre; metre/km değeri ise seçilen durağa kuş uçuşu olarak hesaplanır.
            </p>
          )}
        </div>
      </section>

      {vehicles !== null && vehicles.length > 0 && (
        <section aria-labelledby="active-vehicles-title" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3">
            <h3 id="active-vehicles-title" className="text-sm font-bold text-gray-900">
              Hattaki Aktif Araçlar <span className="font-normal text-gray-500">({activeVehicleRows.length})</span>
            </h3>
            <p className="mt-1 text-xs text-gray-500">Araçların GPS konumuna göre eşleştirilen en yakın güzergâh durakları.</p>
          </div>
          <div className="grid gap-2 p-4 md:grid-cols-2">
            {activeVehicleRows.map(({ vehicle, directionLabel, nearbyStop, nearbyStopDistance, updateTime }) => (
              <div key={`${vehicle.kapino}-${vehicle.guzergahkodu}`} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft-blue/10 text-brand-soft-blue">
                  <Bus className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Kapı No: {vehicle.kapino}</p>
                  <p className="truncate text-xs font-medium text-gray-700">
                    {nearbyStop
                      ? `${nearbyStop.DURAKADI} durağı${nearbyStopDistance !== null ? ` · ${formatDistance(nearbyStopDistance)}` : ''}`
                      : 'Yakın durak bilgisi yok'}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">
                    {directionLabel}{updateTime ? ` · Son konum ${updateTime}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {vehicles === null && !error ? (
        <div className="flex h-[350px] items-center justify-center rounded-xl bg-gray-100 md:h-[450px]">
          <Loader2 className="h-7 w-7 animate-spin text-brand-soft-blue" />
        </div>
      ) : (
        <LiveVehicleMap duraklar={stops} konumlar={vehicles ?? []} />
      )}

      {vehicles !== null && vehicles.length === 0 && !error && (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Bu hat için şu anda aktif araç konumu paylaşılmıyor. Haritada güzergâh ve duraklar gösterilmeye devam eder.
        </p>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs leading-5 text-gray-600">
        Canlı araç verileri yaklaşık 60 saniyede bir yenilenir ve{' '}
        <a
          href="https://data.ibb.gov.tr/dataset/sefer-gerceklesme-web-servisi"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand-soft-blue underline underline-offset-2"
        >
          İETT Sefer Gerçekleşme Web Servisi
          <ExternalLink aria-hidden="true" className="h-3 w-3" />
        </a>{' '}
        üzerinden sağlanır. Veriler{' '}
        <a
          href="https://data.ibb.gov.tr/license"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-soft-blue underline underline-offset-2"
        >
          İBB Açık Veri Lisansı
        </a>{' '}
        kapsamında kullanılır. Hızlı Ulaşım, İBB veya İETT tarafından onaylanmış resmî bir uygulama değildir.
      </div>
    </section>
  );
}
