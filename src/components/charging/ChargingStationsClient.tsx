'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, Loader2, MapPin, Zap, ExternalLink, Navigation, Battery, BatteryCharging } from 'lucide-react';

interface OCMAddress {
  Title?: string;
  AddressLine1?: string;
  Town?: string;
  StateOrProvince?: string;
  Postcode?: string;
  Country?: { Title?: string };
  Latitude: number;
  Longitude: number;
  Distance?: number;
  DistanceUnit?: number;
}

interface OCMConnection {
  ConnectionTypeID?: number;
  ConnectionType?: { Title?: string };
  StatusTypeID?: number;
  StatusType?: { Title?: string };
  LevelID?: number;
  Level?: { Title?: string };
  PowerKW?: number;
  Quantity?: number;
}

interface OCMOperator {
  Title?: string;
  WebsiteURL?: string;
}

interface OCMStatusType {
  IsOperational?: boolean;
  Title?: string;
}

interface OCMStation {
  ID: number;
  AddressInfo: OCMAddress;
  Connections?: OCMConnection[];
  OperatorInfo?: OCMOperator;
  UsageCost?: string;
  StatusType?: OCMStatusType;
  NumberOfPoints?: number;
}

type LocationState =
  | { status: 'loading' }
  | { status: 'active'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'error' };

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ChargingStationsClient() {
  const [stations, setStations] = useState<OCMStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [showCount, setShowCount] = useState(30);
  const [location, setLocation] = useState<LocationState>({ status: 'loading' });
  const [distanceFilter, setDistanceFilter] = useState<number>(25);

  // Get user location
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation({ status: 'error' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ status: 'active', lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Fetch stations
  useEffect(() => {
    let cancelled = false;
    async function fetchStations() {
      try {
        setLoading(true);
        setError(false);
        const params = new URLSearchParams({
          distance: String(distanceFilter),
          maxresults: '100',
        });
        if (location.status === 'active') {
          params.set('lat', String(location.lat));
          params.set('lng', String(location.lng));
        }
        const res = await fetch(`/api/charging?${params.toString()}`);
        if (!res.ok) throw new Error('API error');
        const data: OCMStation[] = await res.json();
        if (cancelled) return;
        setStations(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (location.status !== 'loading') {
      fetchStations();
    }
    return () => { cancelled = true; };
  }, [location, distanceFilter]);

  const filtered = useMemo(() => {
    let list = [...stations];

    if (search.trim()) {
      const q = search.toLocaleLowerCase('tr-TR');
      list = list.filter((s) => {
        const name = (s.AddressInfo?.Title || '').toLocaleLowerCase('tr-TR');
        const addr = (s.AddressInfo?.AddressLine1 || '').toLocaleLowerCase('tr-TR');
        const town = (s.AddressInfo?.Town || '').toLocaleLowerCase('tr-TR');
        const op = (s.OperatorInfo?.Title || '').toLocaleLowerCase('tr-TR');
        return name.includes(q) || addr.includes(q) || town.includes(q) || op.includes(q);
      });
    }

    // Sort by distance if location available
    if (location.status === 'active') {
      list.sort((a, b) => {
        const dA = a.AddressInfo?.Distance ?? haversineDistance(location.lat, location.lng, a.AddressInfo.Latitude, a.AddressInfo.Longitude);
        const dB = b.AddressInfo?.Distance ?? haversineDistance(location.lat, location.lng, b.AddressInfo.Latitude, b.AddressInfo.Longitude);
        return dA - dB;
      });
    }

    return list;
  }, [stations, search, location]);

  const visible = filtered.slice(0, showCount);

  const getMaxPower = useCallback((connections?: OCMConnection[]) => {
    if (!connections?.length) return null;
    const powers = connections.map((c) => c.PowerKW).filter((p): p is number => p != null && p > 0);
    return powers.length > 0 ? Math.max(...powers) : null;
  }, []);

  const getTotalPoints = useCallback((station: OCMStation) => {
    if (station.NumberOfPoints) return station.NumberOfPoints;
    if (!station.Connections?.length) return null;
    const total = station.Connections.reduce((sum, c) => sum + (c.Quantity || 1), 0);
    return total > 0 ? total : null;
  }, []);

  const getConnectionTypes = useCallback((connections?: OCMConnection[]) => {
    if (!connections?.length) return '';
    const types = [...new Set(connections.map((c) => c.ConnectionType?.Title).filter(Boolean))];
    return types.join(', ');
  }, []);

  const getDistance = useCallback((station: OCMStation) => {
    if (location.status !== 'active') return null;
    const d = station.AddressInfo?.Distance ??
      haversineDistance(location.lat, location.lng, station.AddressInfo.Latitude, station.AddressInfo.Longitude);
    return d;
  }, [location]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Şarj istasyonları yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-medium">Şarj istasyonu bilgileri yüklenemedi.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-brand-soft-blue underline"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="İstasyon adı, adres veya operatör ara…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowCount(30); }}
            className="w-full pl-10 pr-9 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={distanceFilter}
          onChange={(e) => { setDistanceFilter(Number(e.target.value)); setShowCount(30); }}
          className="border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40"
        >
          <option value={5}>5 km</option>
          <option value={10}>10 km</option>
          <option value={25}>25 km</option>
          <option value={50}>50 km</option>
          <option value={100}>100 km</option>
        </select>
      </div>

      {/* Stats */}
      <div className="text-xs text-gray-500 mb-3">
        {filtered.length} şarj istasyonu bulundu
        {location.status === 'denied' && (
          <span className="ml-2 text-amber-600">
            (Konum izni verilmedi — mesafe bilgisi gösterilemiyor)
          </span>
        )}
      </div>

      {/* Station List */}
      <div className="flex w-full flex-col gap-3">
        {visible.map((station) => {
          const maxPower = getMaxPower(station.Connections);
          const totalPoints = getTotalPoints(station);
          const connTypes = getConnectionTypes(station.Connections);
          const dist = getDistance(station);
          const isOperational = station.StatusType?.IsOperational !== false;

          return (
            <div
              key={station.ID}
              className={`border rounded-xl p-4 hover:shadow-md transition-shadow ${
                !isOperational ? 'opacity-60 bg-gray-50' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <BatteryCharging className={`w-4 h-4 flex-none ${isOperational ? 'text-green-600' : 'text-gray-400'}`} />
                    <h3 className="font-semibold text-sm text-gray-900 truncate">
                      {station.AddressInfo?.Title || 'Şarj İstasyonu'}
                    </h3>
                  </div>

                  {station.OperatorInfo?.Title && (
                    <p className="text-xs text-brand-soft-blue font-medium mb-1">
                      {station.OperatorInfo.Title}
                    </p>
                  )}

                  <p className="text-xs text-gray-500 mb-2 break-words">
                    <MapPin className="w-3 h-3 inline mr-1 flex-none" />
                    {[station.AddressInfo?.AddressLine1, station.AddressInfo?.Town]
                      .filter(Boolean)
                      .join(', ')}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {maxPower && (
                      <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                        <Zap className="w-3 h-3" /> {maxPower} kW
                      </span>
                    )}
                    {totalPoints && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        <Battery className="w-3 h-3" /> {totalPoints} soket
                      </span>
                    )}
                    {connTypes && (
                      <span className="text-gray-500 truncate max-w-[200px]" title={connTypes}>
                        {connTypes}
                      </span>
                    )}
                    {!isOperational && (
                      <span className="text-red-500 font-medium">Kapalı</span>
                    )}
                  </div>

                  {station.UsageCost && (
                    <p className="text-xs text-gray-500 mt-1">Ücret: {station.UsageCost}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 flex-none">
                  {dist != null && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                    </span>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${station.AddressInfo.Latitude},${station.AddressInfo.Longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-soft-blue hover:text-brand-dark-blue"
                    title="Yol tarifi al"
                  >
                    <Navigation className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && !loading && (
        <div className="text-center py-10 text-gray-400 text-sm">
          Arama kriterlerine uygun şarj istasyonu bulunamadı.
        </div>
      )}

      {visible.length < filtered.length && (
        <button
          onClick={() => setShowCount((c) => c + 30)}
          className="w-full mt-4 py-2.5 text-sm font-medium text-brand-soft-blue border border-brand-soft-blue rounded-xl hover:bg-brand-light-blue/30 transition-colors"
        >
          Daha fazla göster ({filtered.length - visible.length} kaldı)
        </button>
      )}
    </div>
  );
}
