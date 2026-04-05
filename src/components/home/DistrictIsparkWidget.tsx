'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, ParkingCircle, MapPin } from 'lucide-react';
import type { ISPARKPark } from '@/types/ispark';

interface NearestStopDistrict {
  ilceAdi: string;
}

interface ReverseDistrictResponse {
  city?: string;
  district?: string;
}

type LocationState =
  | { status: 'loading' }
  | { status: 'active'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'error' };

function normalizeDistrictName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/\./g, '')
    .replace(/\s+il[çc]esi$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function DistrictIsparkWidget() {
  const [location, setLocation] = useState<LocationState>({ status: 'loading' });
  const [district, setDistrict] = useState<string>('');
  const [parks, setParks] = useState<ISPARKPark[]>([]);
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
        let ilce = '';

        const districtRes = await fetch(`/api/iett/yakin-durak?lat=${location.lat}&lng=${location.lng}`, {
          cache: 'no-store',
        });

        if (districtRes.ok) {
          const districtData: NearestStopDistrict = await districtRes.json();
          ilce = (districtData.ilceAdi || '').trim();
        }

        // Fallback: if nearby-stop fails, resolve district via reverse geocode.
        if (!ilce) {
          const reverseRes = await fetch(`/api/geocode/reverse?lat=${location.lat}&lon=${location.lng}`, {
            cache: 'no-store',
          });

          if (reverseRes.ok) {
            const reverseData: ReverseDistrictResponse = await reverseRes.json();
            ilce = (reverseData.district || '').trim();
          }
        }

        if (!ilce) {
          throw new Error('İlçe bilgisi boşAnlık doluluk bilgileri ve güncel ücret tarifeleri geldi');
        }

        const isparkRes = await fetch('/api/ispark', { cache: 'no-store' });
        if (!isparkRes.ok) {
          throw new Error('ISPARK verisi alınamadı');
        }

        const allParks: ISPARKPark[] = await isparkRes.json();
        const target = normalizeDistrictName(ilce);

        const filtered = allParks
          .filter((p) => {
            const parkDistrict = normalizeDistrictName(p.district || '');
            return parkDistrict === target || parkDistrict.includes(target) || target.includes(parkDistrict);
          })
          .sort((a, b) => b.emptyCapacity - a.emptyCapacity);

        if (cancelled) return;

        setDistrict(ilce);
        setParks(filtered);
      } catch {
        if (!cancelled) {
          setError('İlçene göre otopark bilgisi alınamadı.');
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

  const visibleParks = useMemo(() => parks.slice(0, 12), [parks]);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
        <ParkingCircle className="w-4 h-4 text-brand-soft-blue" />
        Yakınımdaki ISPARK otoparkları
      </h3>

      {location.status === 'loading' && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Konum aliniyor...
        </div>
      )}

      {(location.status === 'denied' || location.status === 'error') && (
        <p className="mt-3 text-xs text-gray-500">Konum bilgisi olmadan ilce tespit edilemedi.</p>
      )}

      {loading && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Otoparklar yukleniyor...
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

      {district && !loading && !error && (
        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-light-blue/25 text-xs text-gray-700">
          <MapPin className="w-3.5 h-3.5 text-brand-soft-blue" />
          {district}
        </div>
      )}

      {district && !loading && !error && visibleParks.length > 0 && (
        <div className="mt-3 -mx-1 px-1 overflow-x-auto">
          <div className="flex gap-3 min-w-max pb-1">
            {visibleParks.map((park) => {
              const occupied = Math.max(0, park.capacity - park.emptyCapacity);
              const occupancyRate = park.capacity > 0 ? (occupied / park.capacity) * 100 : 0;

              return (
                <Link
                  key={park.parkID}
                  href="/otopark-ucretleri"
                  className="w-[250px] flex-shrink-0 border border-gray-200 rounded-xl p-3 hover:border-brand-soft-blue/40 hover:shadow-sm transition-all"
                >
                  <div className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-[40px]">{park.parkName}</div>
                  <div className="mt-2 text-xs text-gray-500">{park.parkType}</div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Boş / Kapasite</span>
                    <span className="font-semibold text-brand-soft-blue">
                      {park.emptyCapacity} / {park.capacity}
                    </span>
                  </div>

                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        occupancyRate > 90 ? 'bg-red-500' : occupancyRate > 70 ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-gray-500">
                    {park.isOpen === 1 ? 'Açık' : 'Kapalı'}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {district && !loading && !error && visibleParks.length === 0 && (
        <p className="mt-3 text-xs text-gray-500">Bu ilçe için ISPARK kaydı bulunamadı.</p>
      )}
    </section>
  );
}
