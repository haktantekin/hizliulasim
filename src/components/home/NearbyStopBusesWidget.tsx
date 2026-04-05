'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin, Loader2, Bus } from 'lucide-react';
import { buildDurakSlug } from '@/lib/slugify';

interface NearestStop {
  durakKodu: string;
  durakAdi: string;
  ilceAdi: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

interface StopLine {
  hatKodu: string;
  hatAdi: string;
  yon: string;
  sirano: number;
}

type LocationState =
  | { status: 'loading' }
  | { status: 'active'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'error' };

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function NearbyStopBusesWidget() {
  const [location, setLocation] = useState<LocationState>({ status: 'loading' });
  const [nearestStop, setNearestStop] = useState<NearestStop | null>(null);
  const [lines, setLines] = useState<StopLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation({ status: 'error' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          status: 'active',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (location.status !== 'active') return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const stopRes = await fetch(`/api/iett/yakin-durak?lat=${location.lat}&lng=${location.lng}`, {
          cache: 'no-store',
        });

        if (!stopRes.ok) {
          throw new Error('Yakin durak bulunamadi');
        }

        const stop: NearestStop = await stopRes.json();
        if (cancelled) return;
        setNearestStop(stop);

        const linesRes = await fetch(`/api/iett/durak-hatlar?kod=${encodeURIComponent(stop.durakKodu)}`, {
          cache: 'no-store',
        });

        if (!linesRes.ok) {
          throw new Error('Duraktan gecen hatlar alinamadi');
        }

        const rawLines: StopLine[] = await linesRes.json();
        if (cancelled) return;
        setLines(Array.isArray(rawLines) ? rawLines : []);
      } catch {
        if (!cancelled) {
          setError('Bilgiler alinamadi. Lutfen tekrar deneyin.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [location]);

  const uniqueLines = useMemo(() => {
    const map = new Map<string, StopLine>();
    for (const line of lines) {
      if (!map.has(line.hatKodu)) {
        map.set(line.hatKodu, line);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.hatKodu.localeCompare(b.hatKodu, 'tr'));
  }, [lines]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
        <MapPin className="w-4 h-4 text-brand-soft-blue" />
        Yakınımdaki duraktan geçen otobüsler
      </h3>

      {location.status === 'loading' && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Konum aliniyor...
        </div>
      )}

      {(location.status === 'denied' || location.status === 'error') && (
        <p className="mt-3 text-xs text-gray-500">Konum bilgisi olmadan yakin durak tespit edilemedi.</p>
      )}

      {loading && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Durak ve hatlar yukleniyor...
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {nearestStop && (
        <div className="mt-3 p-3 rounded-lg bg-brand-light-blue/20 border border-brand-light-blue/40">
          <p className="text-xs text-gray-500">En yakin durak</p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <Link
              href={`/otobus-duraklari/${buildDurakSlug(nearestStop.durakAdi, nearestStop.durakKodu)}`}
              className="text-sm font-medium text-gray-900 hover:text-brand-soft-blue truncate"
            >
              {nearestStop.durakAdi}
            </Link>
            <span className="text-xs text-gray-500 whitespace-nowrap">{formatDistance(nearestStop.distanceMeters)}</span>
          </div>
          {nearestStop.ilceAdi && <p className="text-[11px] text-gray-500 mt-0.5">{nearestStop.ilceAdi}</p>}
        </div>
      )}

      {nearestStop && !loading && uniqueLines.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Hat</th>
                <th className="text-left px-3 py-2">Guzergah</th>
              </tr>
            </thead>
            <tbody>
              {uniqueLines.slice(0, 20).map((line) => (
                <tr key={line.hatKodu} className="border-t border-gray-100">
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <Link
                      href={`/otobus-hatlari/${line.hatKodu}`}
                      className="inline-flex items-center gap-1 text-brand-soft-blue font-semibold hover:underline"
                    >
                      <Bus className="w-3.5 h-3.5" /> {line.hatKodu}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{line.hatAdi || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {uniqueLines.length > 20 && (
            <p className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-100 bg-gray-50">
              Ilk 20 hat gosteriliyor ({uniqueLines.length} toplam)
            </p>
          )}
        </div>
      )}

      {nearestStop && !loading && uniqueLines.length === 0 && !error && (
        <p className="mt-3 text-xs text-gray-500">Bu durak icin aktif hat bilgisi bulunamadi.</p>
      )}
    </section>
  );
}
