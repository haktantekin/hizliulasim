'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { IETTDurakDetay, IETTHatOtoKonum, IETTHat } from '@/types/iett';
import { MapPin, Bus, Navigation, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { buildDurakSlug } from '@/lib/slugify';

const NearestStopMap = dynamic(() => import('../bus/NearestStopMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[200px] md:h-[250px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

type UserLocation =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'active'; lat: number; lng: number };

interface VehicleCandidate {
  vehicle: IETTHatOtoKonum;
  stopsAway: number;
  sameDirection: boolean;
  dataAge: number;
}

const DIRECTION_LABELS: Record<string, string> = {
  D: 'Gidiş',
  G: 'Dönüş',
};

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 50) return 'Çok yakın';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function walkingTime(meters: number): string {
  const minutes = Math.round(meters / 83);
  if (minutes < 1) return '1 dk\'dan az';
  return `~${minutes} dk yürüme`;
}

export default function HomeBusFinder() {
  // Location
  const [userLocation, setUserLocation] = useState<UserLocation>({ status: 'idle' });

  // Hat search
  const [hatInput, setHatInput] = useState('');
  const [hatKodu, setHatKodu] = useState<string | null>(null);
  const [hat, setHat] = useState<IETTHat | null>(null);
  const [duraklar, setDuraklar] = useState<IETTDurakDetay[]>([]);
  const [hatLoading, setHatLoading] = useState(false);
  const [hatError, setHatError] = useState<string | null>(null);

  // Direction & vehicles
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);
  const [konumlar, setKonumlar] = useState<IETTHatOtoKonum[]>([]);
  const [konumLoading, setKonumLoading] = useState(false);
  const [showAllStops, setShowAllStops] = useState(false);

  // Request location on mount
  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setUserLocation({ status: 'error' });
      return;
    }
    setUserLocation({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ status: 'active', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setUserLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const saveSearch = useCallback(async (code: string, name?: string) => {
    try {
      const res = await fetch('/api/bus-searches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hatKodu: code, hatAdi: name || '' }),
      });

      if (!res.ok) return;

      const saved = await res.json();
      if (!saved || typeof saved.hat_kodu !== 'string') return;
    } catch {
      // silent
    }
  }, []);

  // Search hat
  const searchHat = useCallback(async (overrideCode?: string) => {
    const code = (overrideCode ?? hatInput).trim().toUpperCase();
    if (!code) return;

    setHatInput(code);

    setHatLoading(true);
    setHatError(null);
    setHat(null);
    setDuraklar([]);
    setKonumlar([]);
    setSelectedDirection(null);
    setShowAllStops(false);

    try {
      const [hatRes, durakRes] = await Promise.allSettled([
        fetch(`/api/iett/hatlar?kod=${code}`),
        fetch(`/api/iett/durak-detay?hatKodu=${code}`),
      ]);

      let hatData: IETTHat | null = null;
      if (hatRes.status === 'fulfilled' && hatRes.value.ok) {
        const arr = await hatRes.value.json();
        if (Array.isArray(arr) && arr.length > 0) hatData = arr[0];
      }

      if (!hatData) {
        setHatError(`"${code}" kodlu hat bulunamadı.`);
        setHatLoading(false);
        return;
      }

      setHat(hatData);
      setHatKodu(code);
      void saveSearch(code, hatData.SHATADI);

      if (durakRes.status === 'fulfilled' && durakRes.value.ok) {
        setDuraklar(await durakRes.value.json());
      }
    } catch {
      setHatError('Hat bilgisi alınamadı. Lütfen tekrar deneyin.');
    } finally {
      setHatLoading(false);
    }
  }, [hatInput, saveSearch]);

  // Directions
  const directions = useMemo(() => {
    const dirMap = new Map<string, string>();
    for (const d of duraklar) {
      if (!dirMap.has(d.YON)) dirMap.set(d.YON, d.YON_ADI);
    }
    return Array.from(dirMap.entries()).map(([yon, yonAdi]) => ({ yon, yonAdi }));
  }, [duraklar]);

  // Fetch vehicles
  const fetchVehicles = useCallback(async () => {
    if (!hatKodu) return;
    setKonumLoading(true);
    try {
      const res = await fetch(`/api/iett/konum?hatKodu=${hatKodu}`);
      if (res.ok) setKonumlar(await res.json());
    } catch { /* silent */ }
    setKonumLoading(false);
  }, [hatKodu]);

  useEffect(() => {
    if (!hatKodu || !selectedDirection) return;
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 30000);
    return () => clearInterval(interval);
  }, [hatKodu, selectedDirection, fetchVehicles]);

  // Stops in selected direction
  const directionStops = useMemo(() => {
    if (!selectedDirection) return [];
    return duraklar
      .filter((d) => d.YON === selectedDirection)
      .sort((a, b) => a.SIRANO - b.SIRANO);
  }, [duraklar, selectedDirection]);

  // Nearest stop
  const nearestStop = useMemo(() => {
    if (userLocation.status !== 'active' || directionStops.length === 0) return null;

    let minDist = Infinity;
    let closest: IETTDurakDetay | null = null;
    for (const stop of directionStops) {
      if (!stop.YKOORDINATI || !stop.XKOORDINATI || !isFinite(stop.YKOORDINATI) || !isFinite(stop.XKOORDINATI)) continue;
      const dist = haversineDistance(userLocation.lat, userLocation.lng, stop.YKOORDINATI, stop.XKOORDINATI);
      if (dist < minDist) { minDist = dist; closest = stop; }
    }
    return closest ? { stop: closest, distance: minDist } : null;
  }, [userLocation, directionStops]);

  // Vehicle at stop map
  const vehicleAtStopCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const v of konumlar) {
      if (v.yon === selectedDirection && v.yakinDurakKodu) codes.add(v.yakinDurakKodu);
    }
    return codes;
  }, [konumlar, selectedDirection]);

  const vehicleByStopCode = useMemo(() => {
    const map = new Map<string, IETTHatOtoKonum[]>();
    for (const v of konumlar) {
      if (v.yon === selectedDirection && v.yakinDurakKodu) {
        const arr = map.get(v.yakinDurakKodu) || [];
        arr.push(v);
        map.set(v.yakinDurakKodu, arr);
      }
    }
    return map;
  }, [konumlar, selectedDirection]);

  // Best approaching vehicle
  const vehicleInfo = useMemo(() => {
    if (!nearestStop) return null;
    const { stop } = nearestStop;
    const stopIndex = directionStops.findIndex((d) => d.DURAKKODU === stop.DURAKKODU);
    if (stopIndex === -1) return null;

    const candidates: VehicleCandidate[] = [];
    const now = Date.now();

    for (const v of konumlar) {
      const lat = parseFloat(v.enlem);
      const lng = parseFloat(v.boylam);
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const sameDirection = v.yon === stop.YON;
      let vehicleStopIndex = -1;
      if (v.yakinDurakKodu) {
        vehicleStopIndex = directionStops.findIndex((d) => d.DURAKKODU === v.yakinDurakKodu);
      }
      if (vehicleStopIndex === -1) {
        let minV = Infinity;
        for (let i = 0; i < directionStops.length; i++) {
          const d = haversineDistance(lat, lng, directionStops[i].YKOORDINATI, directionStops[i].XKOORDINATI);
          if (d < minV) { minV = d; vehicleStopIndex = i; }
        }
      }

      const stopsAway = stopIndex - vehicleStopIndex;
      if (stopsAway < 0) continue;

      let dataAge = 300;
      if (v.son_konum_zamani) {
        const parts = v.son_konum_zamani.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
        if (parts) {
          const ts = new Date(+parts[3], +parts[2] - 1, +parts[1], +parts[4], +parts[5], +parts[6]);
          dataAge = Math.max(0, (now - ts.getTime()) / 1000);
        }
      }
      if (dataAge > 600) continue;

      candidates.push({ vehicle: v, stopsAway, sameDirection, dataAge });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (a.sameDirection !== b.sameDirection) return a.sameDirection ? -1 : 1;
      if (a.stopsAway !== b.stopsAway) return a.stopsAway - b.stopsAway;
      return a.dataAge - b.dataAge;
    });

    const best = candidates[0];

    let etaText: string;
    if (best.stopsAway === 0) {
      etaText = 'Durakta';
    } else if (best.stopsAway <= 2) {
      etaText = `${best.stopsAway} durak uzakta`;
    } else if (hat && hat.SEFER_SURESI > 0 && directionStops.length > 1) {
      const avgMin = hat.SEFER_SURESI / directionStops.length;
      const est = Math.round(best.stopsAway * avgMin);
      if (est > 0 && est < 120) {
        etaText = `Yaklaşık ${est} dk (${best.stopsAway} durak uzakta)`;
      } else {
        etaText = `${best.stopsAway} durak uzakta`;
      }
    } else {
      etaText = `${best.stopsAway} durak uzakta`;
    }

    const others = konumlar.filter((v) => v.kapino !== best.vehicle.kapino);
    return { best, etaText, others };
  }, [nearestStop, konumlar, directionStops, hat]);

  // Remaining stops (from user's nearest stop onward)
  const remainingStops = useMemo(() => {
    if (!nearestStop) return directionStops;
    const idx = directionStops.findIndex((d) => d.DURAKKODU === nearestStop.stop.DURAKKODU);
    if (idx === -1) return directionStops;
    return directionStops.slice(idx);
  }, [directionStops, nearestStop]);

  const userStopIndex = nearestStop
    ? directionStops.findIndex((d) => d.DURAKKODU === nearestStop.stop.DURAKKODU)
    : -1;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-brand-soft-blue/5 to-transparent">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
          <Navigation className="w-4 h-4 text-brand-soft-blue" />
          Yakınımdaki Otobüs
        </h3>
        <p className="text-xs text-gray-500 mt-1">Hat kodunu girin, yön seçin — en yakın durağınız ve yaklaşan otobüsü görün.</p>

        {/* Location status */}
        {userLocation.status === 'loading' && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Konum alınıyor...
          </div>
        )}
        {userLocation.status === 'active' && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
            <MapPin className="w-3.5 h-3.5" /> Konum alındı
          </div>
        )}
        {(userLocation.status === 'denied' || userLocation.status === 'error') && (
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>{userLocation.status === 'denied' ? 'Konum izni reddedildi.' : 'Konum alınamadı.'}</span>
            <button onClick={requestLocation} className="text-brand-soft-blue hover:underline">Tekrar Dene</button>
          </div>
        )}
      </div>

      {/* Hat search */}
      <div className="p-4 border-b border-gray-100">
        <form
          onSubmit={(e) => { e.preventDefault(); searchHat(); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={hatInput}
            onChange={(e) => setHatInput(e.target.value.toUpperCase())}
            placeholder="Hat kodu (örn: 500T)"
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30 focus:border-brand-soft-blue"
          />
          <button
            type="submit"
            disabled={hatLoading || !hatInput.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-soft-blue text-white rounded-lg text-sm font-medium hover:bg-brand-dark-blue transition-colors disabled:opacity-50"
          >
            {hatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Ara
          </button>
        </form>
        {hatError && <p className="text-xs text-red-500 mt-2">{hatError}</p>}

        {/* Hat info */}
        {hat && (
          <div className="mt-3 flex items-center gap-3 bg-brand-light-blue/20 rounded-lg p-3">
            <div className="w-10 h-10 bg-brand-soft-blue rounded-lg flex items-center justify-center flex-shrink-0">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-brand-soft-blue">{hat.SHATKODU}</div>
              <div className="text-xs text-gray-500 truncate">{hat.SHATADI}</div>
            </div>
            <Link
              href={`/otobus-hatlari/${hat.SHATKODU}`}
              className="text-xs text-brand-soft-blue hover:underline flex-shrink-0"
            >
              Detay →
            </Link>
          </div>
        )}
      </div>

      {/* Direction selector */}
      {hat && directions.length > 0 && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center">
            <select
              value={selectedDirection ?? ''}
              onChange={(e) => { setSelectedDirection(e.target.value || null); setShowAllStops(false); }}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30 focus:border-brand-soft-blue appearance-none"
            >
              <option value="">Yön seçin...</option>
              {directions.map(({ yon, yonAdi }) => (
                <option key={yon} value={yon}>
                  {DIRECTION_LABELS[yon] || yon}{yonAdi ? ` — ${yonAdi}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      {hat && selectedDirection && (
        <>
          {/* Map */}
          {nearestStop && userLocation.status === 'active' && (
            <NearestStopMap
              userLat={userLocation.lat}
              userLng={userLocation.lng}
              stop={nearestStop.stop}
              selectedVehicle={vehicleInfo?.best.vehicle ?? null}
              otherVehicles={vehicleInfo?.others ?? []}
            />
          )}

          <div className="p-4 space-y-4">
            {/* Nearest stop */}
            {nearestStop ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">En Yakın Durak</div>
                  <div className="font-medium text-sm text-gray-900 truncate">{nearestStop.stop.DURAKADI}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                    <span className="font-mono">{nearestStop.stop.DURAKKODU}</span>
                    <span>•</span>
                    <span>{formatDistance(nearestStop.distance)}</span>
                    <span>•</span>
                    <span>{walkingTime(nearestStop.distance)}</span>
                  </div>
                </div>
              </div>
            ) : userLocation.status !== 'active' ? (
              <div className="text-sm text-gray-500 text-center py-2">
                En yakın durağı görmek için konum izni verin.
              </div>
            ) : null}

            {/* Approaching vehicle */}
            {nearestStop && vehicleInfo ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bus className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">Yaklaşan Otobüs</div>
                  <div className="font-medium text-sm text-gray-900">Kapı No: {vehicleInfo.best.vehicle.kapino}</div>
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      vehicleInfo.best.stopsAway === 0
                        ? 'bg-green-100 text-green-700'
                        : vehicleInfo.best.stopsAway <= 3
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}>
                      {vehicleInfo.etaText}
                    </span>
                  </div>
                  {!vehicleInfo.best.sameDirection && (
                    <div className="text-xs text-amber-600 mt-1">⚠ Farklı yön — tahmini bilgi</div>
                  )}
                </div>
              </div>
            ) : nearestStop && !konumLoading ? (
              <div className="text-xs text-gray-500">Şu anda bu durağa yaklaşan aktif araç bulunamadı.</div>
            ) : null}

            {/* Remaining stops */}
            {remainingStops.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-gray-700">
                    {nearestStop ? 'Kalan Duraklar' : 'Duraklar'} ({remainingStops.length})
                  </div>
                  {konumLoading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                </div>

                <div className="relative">
                  {(showAllStops ? remainingStops : remainingStops.slice(0, 5)).map((stop, idx) => {
                    const isUserStop = nearestStop?.stop.DURAKKODU === stop.DURAKKODU;
                    const hasBus = vehicleAtStopCodes.has(stop.DURAKKODU);
                    const busesHere = vehicleByStopCode.get(stop.DURAKKODU);
                    const isFirst = idx === 0;
                    const displayStops = showAllStops ? remainingStops : remainingStops.slice(0, 5);
                    const isLast = idx === displayStops.length - 1;

                    return (
                      <div key={stop.DURAKKODU} className="flex gap-2.5 group">
                        <div className="flex flex-col items-center w-5 flex-shrink-0">
                          <div className={`w-0.5 flex-1 ${isFirst ? 'bg-transparent' : 'bg-gray-200'}`} />
                          <div className={`rounded-full flex-shrink-0 border-2 flex items-center justify-center ${
                            hasBus
                              ? 'w-5 h-5 bg-green-500 border-green-500'
                              : isUserStop
                                ? 'w-4 h-4 bg-brand-orange border-brand-orange'
                                : 'w-2.5 h-2.5 bg-white border-gray-300'
                          }`}>
                            {hasBus && <Bus className="w-3 h-3 text-white" />}
                          </div>
                          <div className={`w-0.5 flex-1 ${isLast ? 'bg-transparent' : 'bg-gray-200'}`} />
                        </div>
                        <div className={`flex-1 pb-2 ${isLast ? 'pb-0' : ''}`}>
                          <Link
                            href={`/otobus-duraklari/${buildDurakSlug(stop.DURAKADI, stop.DURAKKODU)}`}
                            className={`block rounded-lg px-2.5 py-1.5 transition-all text-xs ${
                              hasBus ? 'bg-green-50' : isUserStop ? 'bg-orange-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className={`font-medium ${
                              hasBus ? 'text-green-700' : isUserStop ? 'text-brand-orange' : 'text-gray-800'
                            }`}>
                              {stop.DURAKADI}
                            </span>
                            {hasBus && busesHere && (
                              <span className="ml-2">
                                {busesHere.map((b) => (
                                  <span key={b.kapino} className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1">
                                    <Bus className="w-2.5 h-2.5" /> {b.kapino}
                                  </span>
                                ))}
                              </span>
                            )}
                            {isUserStop && <span className="ml-1.5 text-[10px] text-brand-orange">📍 Siz buradasınız</span>}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {remainingStops.length > 5 && (
                  <button
                    onClick={() => setShowAllStops((p) => !p)}
                    className="mt-1.5 flex items-center gap-1 text-xs text-brand-soft-blue hover:underline w-full justify-center"
                  >
                    {showAllStops ? (
                      <><ChevronUp className="w-3.5 h-3.5" /> Kısalt</>
                    ) : (
                      <><ChevronDown className="w-3.5 h-3.5" /> Tüm durakları göster (+{remainingStops.length - 5})</>
                    )}
                  </button>
                )}

                <div className="text-[10px] text-gray-400 mt-2 text-center">Veriler her 30 saniyede güncellenir</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
