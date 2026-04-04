'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { IETTDurakDetay, IETTHatOtoKonum, IETTHat } from '@/types/iett';
import type { UserLocation } from './BusRouteDetailClient';
import { MapPin, Bus, Navigation, Loader2, ArrowRightLeft } from 'lucide-react';

const NearestStopMap = dynamic(() => import('./NearestStopMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[250px] md:h-[300px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

interface Props {
  hatKodu: string;
  hat: IETTHat;
  duraklar: IETTDurakDetay[];
  userLocation: UserLocation;
}

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

export default function NearestStopAssistant({ hatKodu, hat, duraklar, userLocation }: Props) {
  const [konumlar, setKonumlar] = useState<IETTHatOtoKonum[]>([]);
  const [konumLoading, setKonumLoading] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<string | null>(null);

  const directions = useMemo(() => {
    const dirMap = new Map<string, string>();
    for (const d of duraklar) {
      if (!dirMap.has(d.YON)) dirMap.set(d.YON, d.YON_ADI);
    }
    return Array.from(dirMap.entries()).map(([yon, yonAdi]) => ({ yon, yonAdi }));
  }, [duraklar]);

  const fetchVehicles = useCallback(async () => {
    setKonumLoading(true);
    try {
      const res = await fetch(`/api/iett/konum?hatKodu=${hatKodu}`);
      if (res.ok) setKonumlar(await res.json());
    } catch { /* silent */ }
    setKonumLoading(false);
  }, [hatKodu]);

  // Auto-fetch vehicles when location is active, refresh every 30s
  useEffect(() => {
    if (userLocation.status !== 'active') return;
    fetchVehicles();
    const interval = setInterval(fetchVehicles, 30000);
    return () => clearInterval(interval);
  }, [userLocation.status, fetchVehicles]);

  // Find nearest stop
  const nearestStop = useMemo(() => {
    if (userLocation.status !== 'active' || !selectedDirection) return null;

    const validStops = duraklar.filter(
      (d) => d.YON === selectedDirection && d.YKOORDINATI && d.XKOORDINATI && isFinite(d.YKOORDINATI) && isFinite(d.XKOORDINATI)
    );
    if (validStops.length === 0) return null;

    let minDist = Infinity;
    let closest: IETTDurakDetay | null = null;
    for (const stop of validStops) {
      const dist = haversineDistance(userLocation.lat, userLocation.lng, stop.YKOORDINATI, stop.XKOORDINATI);
      if (dist < minDist) { minDist = dist; closest = stop; }
    }
    return closest ? { stop: closest, distance: minDist } : null;
  }, [userLocation, duraklar, selectedDirection]);

  // Select best approaching vehicle
  const vehicleInfo = useMemo(() => {
    if (!nearestStop) return null;
    const { stop } = nearestStop;

    const directionStops = duraklar
      .filter((d) => d.YON === stop.YON)
      .sort((a, b) => a.SIRANO - b.SIRANO);

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
        let minVehicleDist = Infinity;
        for (let i = 0; i < directionStops.length; i++) {
          const d = haversineDistance(lat, lng, directionStops[i].YKOORDINATI, directionStops[i].XKOORDINATI);
          if (d < minVehicleDist) { minVehicleDist = d; vehicleStopIndex = i; }
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
    } else {
      const totalStops = directionStops.length;
      if (hat.SEFER_SURESI > 0 && totalStops > 1) {
        const avgMinPerStop = hat.SEFER_SURESI / totalStops;
        const estimatedMin = Math.round(best.stopsAway * avgMinPerStop);
        if (estimatedMin > 0 && estimatedMin < 120) {
          etaText = `Yaklaşık ${estimatedMin} dk (${best.stopsAway} durak uzakta)`;
        } else {
          etaText = `${best.stopsAway} durak uzakta`;
        }
      } else {
        etaText = `${best.stopsAway} durak uzakta`;
      }
    }

    const others = konumlar.filter((v) => v.kapino !== best.vehicle.kapino);
    return { best, etaText, others };
  }, [nearestStop, konumlar, duraklar, hat]);

  // Don't render if location not active
  if (userLocation.status !== 'active') return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <Navigation className="w-4 h-4 text-brand-soft-blue" />
            Yakınımdaki Durak ve Yaklaşan Otobüs
          </h3>
          {konumLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
        </div>

        {directions.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <ArrowRightLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500">Yön:</span>
            {directions.map(({ yon, yonAdi }) => (
              <button
                key={yon}
                onClick={() => setSelectedDirection(yon)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedDirection === yon
                    ? 'bg-brand-soft-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {DIRECTION_LABELS[yon] || yon}{yonAdi ? ` — ${yonAdi}` : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedDirection && (
        <div className="p-4 text-center text-sm text-gray-500">
          <ArrowRightLeft className="w-6 h-6 mx-auto mb-2 text-gray-300" />
          Lütfen yukarıdan gitmek istediğiniz yönü seçin.
        </div>
      )}

      {selectedDirection && nearestStop && (
        <NearestStopMap
          userLat={userLocation.lat}
          userLng={userLocation.lng}
          stop={nearestStop.stop}
          selectedVehicle={vehicleInfo?.best.vehicle ?? null}
          otherVehicles={vehicleInfo?.others ?? []}
        />
      )}

      {selectedDirection && (
      <div className="p-4 space-y-4">
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
              <div className="text-xs text-gray-400 mt-0.5">
                Yön: {nearestStop.stop.YON_ADI} ({nearestStop.stop.SIRANO}. durak)
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 text-center py-2">
            Bu hat için durak bilgisi bulunamadı.
          </div>
        )}

        {nearestStop && vehicleInfo ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Bus className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500">Yaklaşan Otobüs</div>
              <div className="font-medium text-sm text-gray-900">
                Kapı No: {vehicleInfo.best.vehicle.kapino}
              </div>
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
                <div className="text-xs text-amber-600 mt-1">
                  ⚠ Farklı yön — tahmini bilgi
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                Veriler her 30 saniyede güncellenir
              </div>
            </div>
          </div>
        ) : nearestStop && !konumLoading ? (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0">
              <Bus className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500">Yaklaşan Otobüs</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Şu anda bu durağa yaklaşan aktif araç bulunamadı.
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Veriler her 30 saniyede güncellenir
              </div>
            </div>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
