'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { IETTPlanlananSefer, IETTHatOtoKonum, IETTHat, IETTDurakDetay } from '@/types/iett';
import { Clock, Bus, MapPin, Route, Info, ChevronDown, ChevronUp, RefreshCw, CircleDot, Heart, Navigation, Loader2 } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useUpdateFavorite } from '@/hooks/useAuth';
import AuthModal from '@/components/ui/AuthModal';
import NearestStopAssistant from './NearestStopAssistant';
import Link from 'next/link';
import { buildDurakSlug } from '@/lib/slugify';

const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

const LiveVehicleMap = dynamic(() => import('./LiveVehicleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-gray-300" />
    </div>
  ),
});

interface Props {
  hatKodu: string;
  wpContent?: string | null;
}

const DAY_TYPE_LABELS: Record<string, string> = {
  C: 'Hafta İçi',
  I: 'Cumartesi',
  P: 'Pazar',
};

const DIRECTION_LABELS: Record<string, string> = {
  D: 'Gidiş',
  G: 'Dönüş',
};

export type UserLocation =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error' }
  | { status: 'active'; lat: number; lng: number };

export default function BusRouteDetailClient({ hatKodu, wpContent }: Props) {
  // Data fetched client-side after page loads
  const [hat, setHat] = useState<IETTHat | null>(null);
  const [seferler, setSeferler] = useState<IETTPlanlananSefer[]>([]);
  const [duraklar, setDuraklar] = useState<IETTDurakDetay[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(false);

  const [activeTab, setActiveTab] = useState<'info' | 'route' | 'schedule' | 'vehicles'>('schedule');
  const [selectedDayType, setSelectedDayType] = useState<string>('C');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Shared geolocation - requested once on mount
  const [userLocation, setUserLocation] = useState<UserLocation>({ status: 'idle' });

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

  // Auto-request location on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Live vehicle locations - fetched client-side for real-time data
  const [konumlar, setKonumlar] = useState<IETTHatOtoKonum[]>([]);
  const [konumLoading, setKonumLoading] = useState(false);
  const [konumError, setKonumError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [durakAdlari, setDurakAdlari] = useState<Record<string, string>>({});

  // Favorites
  const { isAuthenticated, favorites } = useAppSelector((state) => state.user);
  const updateFavorite = useUpdateFavorite();
  const isFavorite = isAuthenticated && hat !== null && favorites.routes.some((r) => r.id === hat.SHATKODU);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Fetch all IETT data client-side after page loads
  useEffect(() => {
    async function fetchData() {
      setDataLoading(true);
      setDataError(false);
      try {
        const [hatRes, seferRes, durakRes] = await Promise.allSettled([
          fetch(`/api/iett/hatlar?kod=${hatKodu}`),
          fetch(`/api/iett/sefer-saatleri?hatKodu=${hatKodu}`),
          fetch(`/api/iett/durak-detay?hatKodu=${hatKodu}`),
        ]);

        if (hatRes.status === 'fulfilled' && hatRes.value.ok) {
          const hatData = await hatRes.value.json();
          if (Array.isArray(hatData) && hatData.length > 0) {
            setHat(hatData[0]);
          }
        }

        if (seferRes.status === 'fulfilled' && seferRes.value.ok) {
          setSeferler(await seferRes.value.json());
        }

        if (durakRes.status === 'fulfilled' && durakRes.value.ok) {
          setDuraklar(await durakRes.value.json());
        }
      } catch {
        setDataError(true);
      } finally {
        setDataLoading(false);
      }
    }
    fetchData();
  }, [hatKodu]);

  // Fetch stop names for vehicle locations
  const fetchDurakAdlari = useCallback(async (vehicles: IETTHatOtoKonum[]) => {
    const codes = [...new Set(vehicles.map((v) => v.yakinDurakKodu).filter(Boolean))];
    const missing = codes.filter((c) => !durakAdlari[c]);
    if (missing.length === 0) return;

    const results: Record<string, string> = {};
    await Promise.allSettled(
      missing.map(async (code) => {
        try {
          const res = await fetch(`/api/iett/durak?kod=${code}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.SDURAKADI) results[code] = data.SDURAKADI;
          }
        } catch { /* ignore */ }
      })
    );
    if (Object.keys(results).length > 0) {
      setDurakAdlari((prev) => ({ ...prev, ...results }));
    }
  }, [durakAdlari]);

  const fetchKonumlar = useCallback(async () => {
    setKonumLoading(true);
    setKonumError(false);
    try {
      const res = await fetch(`/api/iett/konum?hatKodu=${hatKodu}`);
      if (!res.ok) throw new Error('fetch failed');
      const data: IETTHatOtoKonum[] = await res.json();
      setKonumlar(data);
      setLastRefresh(new Date());
      fetchDurakAdlari(data);
    } catch {
      setKonumError(true);
    } finally {
      setKonumLoading(false);
    }
  }, [hatKodu]);

  // Fetch live locations when vehicles or route tab is active
  useEffect(() => {
    if (activeTab !== 'vehicles' && activeTab !== 'route') return;
    fetchKonumlar();
    const interval = setInterval(fetchKonumlar, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [activeTab, fetchKonumlar]);

  // Group schedules by direction and day type
  const groupedSchedule = useMemo(() => {
    const groups = new Map<string, { direction: string; dayType: string; times: string[]; routeName: string; serviceType: string }>();
    
    for (const sefer of seferler) {
      const key = `${sefer.SYON}_${sefer.SGUNTIPI}`;
      if (!groups.has(key)) {
        groups.set(key, {
          direction: sefer.SYON,
          dayType: sefer.SGUNTIPI,
          times: [],
          routeName: sefer.HATADI,
          serviceType: sefer.SSERVISTIPI || '',
        });
      }
      groups.get(key)!.times.push(sefer.DT);
    }

    // Sort times within each group
    for (const group of groups.values()) {
      group.times.sort();
    }

    return Array.from(groups.values());
  }, [seferler]);

  // Available day types
  const dayTypes = useMemo(() => {
    const types = new Set(seferler.map((s) => s.SGUNTIPI));
    return Array.from(types);
  }, [seferler]);

  // Filter schedules by selected day type
  const filteredSchedule = useMemo(() => {
    return groupedSchedule.filter((g) => g.dayType === selectedDayType);
  }, [groupedSchedule, selectedDayType]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Hat info cards
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0) return `${h} saat ${m} dk`;
    return `${m} dk`;
  };

  if (dataLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl p-4 h-20" />
          ))}
        </div>
        <div className="flex gap-2 border-b pb-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded h-9 w-32" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (dataError || !hat) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bus className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 mb-2">
          Hat Bilgisi {dataError ? 'Alınamadı' : 'Bulunamadı'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {dataError
            ? 'İETT API\'sine bağlanılamadı. Lütfen daha sonra tekrar deneyin.'
            : (
              <>
                <span className="font-semibold">{hatKodu}</span> kodlu otobüs hattı İETT sisteminde bulunamadı.
                <br />
                Hat kodu doğru yazıldığından emin olun veya farklı bir hat arayın.
              </>
            )}
        </p>
        <Link
          href="/otobus-hatlari"
          className="px-5 py-2.5 bg-brand-soft-blue text-white rounded-xl text-sm font-medium hover:bg-brand-dark-blue transition-colors"
        >
          Tüm Hatları Görüntüle
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Favorite Button */}
      <div className="flex justify-start">
        <button
          onClick={() => {
            if (!isAuthenticated) { setAuthModalOpen(true); return; }
            updateFavorite.mutate({
              type: 'routes',
              action: isFavorite ? 'remove' : 'add',
              item: { id: hat.SHATKODU, name: hat.SHATADI },
            });
          }}
          disabled={updateFavorite.isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isFavorite
              ? 'bg-orange-50 text-brand-orange hover:bg-orange-100'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-brand-orange' : ''}`} />
          {isFavorite ? 'Favorilerimde' : 'Favorilere Ekle'}
        </button>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Hat Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-brand-light-blue/30 rounded-xl p-4 text-center">
          <Bus className="w-5 h-5 mx-auto mb-1 text-brand-soft-blue" />
          <div className="text-xs text-gray-500">Hat Kodu</div>
          <div className="font-bold text-brand-soft-blue">{hat.SHATKODU}</div>
        </div>
        <div className="bg-brand-light-blue/30 rounded-xl p-4 text-center">
          <Route className="w-5 h-5 mx-auto mb-1 text-brand-soft-blue" />
          <div className="text-xs text-gray-500">Hat Uzunluğu</div>
          <div className="font-bold text-brand-soft-blue">{hat.HAT_UZUNLUGU.toFixed(1)} km</div>
        </div>
        <div className="bg-brand-light-blue/30 rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-brand-soft-blue" />
          <div className="text-xs text-gray-500">Sefer Süresi</div>
          <div className="font-bold text-brand-soft-blue">{formatDuration(hat.SEFER_SURESI)}</div>
        </div>
        <div className="bg-brand-light-blue/30 rounded-xl p-4 text-center">
          <Info className="w-5 h-5 mx-auto mb-1 text-brand-soft-blue" />
          <div className="text-xs text-gray-500">Tarife</div>
          <div className="font-bold text-brand-soft-blue text-sm">{hat.TARIFE}</div>
        </div>
      </div>

      {/* Location status banner */}
      {userLocation.status === 'loading' && (
        <div className="flex items-center gap-2 bg-brand-light-blue/20 border border-brand-soft-blue/20 rounded-xl px-4 py-2.5">
          <Loader2 className="w-4 h-4 text-brand-soft-blue animate-spin" />
          <span className="text-sm text-gray-600">Konumunuz alınıyor...</span>
        </div>
      )}
      {(userLocation.status === 'denied' || userLocation.status === 'error') && (
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-gray-500">
            {userLocation.status === 'denied' ? 'Konum izni reddedildi.' : 'Konum alınamadı.'}
          </span>
          <button onClick={requestLocation} className="text-xs text-brand-soft-blue hover:underline">Tekrar Dene</button>
        </div>
      )}

      {/* Nearest Stop Assistant */}
      {duraklar.length > 0 && (
        <NearestStopAssistant hatKodu={hatKodu} hat={hat} duraklar={duraklar} userLocation={userLocation} />
      )}

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'border-brand-soft-blue text-brand-soft-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {hat.SHATKODU} Sefer Saatleri
        </button>
        <button
          onClick={() => setActiveTab('route')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'route'
              ? 'border-brand-soft-blue text-brand-soft-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Güzergah
          {duraklar.length > 0 && (
            <span className="bg-brand-soft-blue/10 text-brand-soft-blue text-xs px-1.5 py-0.5 rounded-full">
              {duraklar.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'vehicles'
              ? 'border-brand-soft-blue text-brand-soft-blue'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >

          Canlı Araç Konumları
          {konumlar.length > 0 && (
            <span className="bg-brand-green text-white text-xs px-1.5 py-0.5 rounded-full">
              {konumlar.length}
            </span>
          )}
        </button>
        {wpContent && (
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-brand-soft-blue text-brand-soft-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {hat.SHATKODU} Hat Bilgileri
          </button>
        )}

      </div>

      {/* Tab Content */}
      {activeTab === 'info' && wpContent && (
        <article className="post-detail prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: wpContent }} />
      )}

      {activeTab === 'route' && (
        <RouteStopsTab duraklar={duraklar} konumlar={konumlar} hatKodu={hatKodu} userLocation={userLocation} />
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Day Type Selector */}
          {dayTypes.length > 0 && (
            <div className="flex gap-2">
              {dayTypes.map((dt) => (
                <button
                  key={dt}
                  onClick={() => setSelectedDayType(dt)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDayType === dt
                      ? 'bg-brand-soft-blue text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {DAY_TYPE_LABELS[dt] || dt}
                </button>
              ))}
            </div>
          )}

          {filteredSchedule.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Bu gün tipi için sefer bilgisi bulunamadı.
            </div>
          ) : (
            filteredSchedule.map((group) => {
              const groupKey = `${group.direction}_${group.dayType}`;
              const isExpanded = expandedGroups.has(groupKey) || filteredSchedule.length <= 2;
              const displayTimes = isExpanded ? group.times : group.times.slice(0, 12);

              return (
                <div key={groupKey} className="bg-white border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        group.direction === 'D' ? 'bg-brand-soft-blue' : 'bg-brand-green'
                      }`}>
                        {group.direction === 'D' ? 'G' : 'D'}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm">
                          {DIRECTION_LABELS[group.direction] || group.direction} - {group.routeName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {group.times.length} sefer • {group.serviceType && `${group.serviceType} • `}
                          İlk: {group.times[0]} - Son: {group.times[group.times.length - 1]}
                        </div>
                      </div>
                    </div>
                    {group.times.length > 12 && (
                      isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                      {displayTimes.map((time, idx) => (
                        <div
                          key={`${groupKey}-${idx}`}
                          className="bg-gray-50 text-center py-1.5 px-2 rounded text-sm font-mono text-gray-700"
                        >
                          {time}
                        </div>
                      ))}
                    </div>
                    {!isExpanded && group.times.length > 12 && (
                      <button
                        onClick={() => toggleGroup(groupKey)}
                        className="mt-2 text-xs text-brand-soft-blue hover:underline"
                      >
                        +{group.times.length - 12} sefer daha göster
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="space-y-3">
          {/* Live vehicle map */}
          {duraklar.length > 0 && (
            <LiveVehicleMap duraklar={duraklar} konumlar={konumlar} />
          )}

          {/* Refresh bar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {konumLoading
                ? 'Araç konumları yükleniyor...'
                : konumlar.length > 0
                  ? `Hatta aktif ${konumlar.length} araç bulunmaktadır.`
                  : ''}
            </div>
            <button
              onClick={fetchKonumlar}
              disabled={konumLoading}
              className="flex items-center gap-1.5 text-xs text-brand-soft-blue hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${konumLoading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>
          {lastRefresh && (
            <div className="text-xs text-gray-400">
              Son güncelleme: {lastRefresh.toLocaleTimeString('tr-TR')}
            </div>
          )}

          {konumError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Araç konum bilgileri alınamadı. Yeniden deneyin.
            </div>
          )}

          {!konumLoading && konumlar.length === 0 && !konumError ? (
            <div className="text-center py-8 text-gray-500">
              <Bus className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Şu anda bu hatta aktif araç bulunmuyor.</p>
              <p className="text-xs mt-1">Veriler her 30 saniyede otomatik güncellenir.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {konumlar.map((k, idx) => {
                // Parse the timestamp for display
                const timeStr = k.son_konum_zamani
                  ? k.son_konum_zamani.split(' ')[1]?.substring(0, 5)
                  : '';

                return (
                  <div key={`vehicle-${idx}`} className="flex items-center gap-3 bg-white border rounded-lg p-3">
                    <div className="w-10 h-10 bg-brand-soft-blue/10 rounded-full flex items-center justify-center">
                      <Bus className="w-5 h-5 text-brand-soft-blue" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{k.kapino}</span>
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                          {k.hatkodu}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs text-gray-500 mt-1">
                        <span>Yön: {k.yon}</span>
                        {k.yakinDurakKodu && (
                          <span>Yakın Durak: {durakAdlari[k.yakinDurakKodu] || k.yakinDurakKodu}</span>
                        )}
                        {timeStr && (
                          <span>Son Konum: {timeStr}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


    </div>
  );
}

// ==========================================
// Güzergah / Duraklar Tab Component
// ==========================================

function RouteStopsTab({ duraklar, konumlar, hatKodu, userLocation }: { duraklar: IETTDurakDetay[]; konumlar: IETTHatOtoKonum[]; hatKodu: string; userLocation: UserLocation }) {
  const [selectedDirection, setSelectedDirection] = useState<string>('D');
  const [userStopCode, setUserStopCode] = useState<string | null>(null);
  const [showPastStops, setShowPastStops] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);

  // Group stops by direction
  const directions = useMemo(() => {
    const dirSet = new Set(duraklar.map((d) => d.YON));
    return Array.from(dirSet);
  }, [duraklar]);

  // Set initial direction
  useEffect(() => {
    if (directions.length > 0 && !directions.includes(selectedDirection)) {
      setSelectedDirection(directions[0]);
    }
  }, [directions, selectedDirection]);

  // Reset user stop when direction changes
  useEffect(() => {
    setUserStopCode(null);
    setShowPastStops(false);
    setAutoSelected(false);
  }, [selectedDirection]);

  // All stops in selected direction sorted
  const allDirectionStops = useMemo(() => {
    return duraklar
      .filter((d) => d.YON === selectedDirection)
      .sort((a, b) => a.SIRANO - b.SIRANO);
  }, [duraklar, selectedDirection]);

  // Auto-select nearest stop when location is active
  useEffect(() => {
    if (userLocation.status !== 'active' || autoSelected || allDirectionStops.length === 0) return;

    let minDist = Infinity;
    let closestCode: string | null = null;
    for (const stop of allDirectionStops) {
      if (!stop.YKOORDINATI || !stop.XKOORDINATI || !isFinite(stop.YKOORDINATI) || !isFinite(stop.XKOORDINATI)) continue;
      const R = 6371000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(stop.YKOORDINATI - userLocation.lat);
      const dLon = toRad(stop.XKOORDINATI - userLocation.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userLocation.lat)) * Math.cos(toRad(stop.YKOORDINATI)) * Math.sin(dLon / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist < minDist) {
        minDist = dist;
        closestCode = stop.DURAKKODU;
      }
    }
    if (closestCode) {
      setUserStopCode(closestCode);
      setAutoSelected(true);
    }
  }, [userLocation, allDirectionStops, autoSelected]);

  // Get vehicle stop codes in this direction for highlighting
  const vehicleAtStopCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const v of konumlar) {
      if (v.yon === selectedDirection && v.yakinDurakKodu) {
        codes.add(v.yakinDurakKodu);
      }
    }
    return codes;
  }, [konumlar, selectedDirection]);

  // Map vehicle stop code -> vehicle info for tooltip
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

  // User stop index
  const userStopIndex = useMemo(() => {
    if (!userStopCode) return -1;
    return allDirectionStops.findIndex((d) => d.DURAKKODU === userStopCode);
  }, [allDirectionStops, userStopCode]);

  // Visible stops: if user selected a stop, filter past ones
  const filteredStops = useMemo(() => {
    if (!userStopCode || userStopIndex === -1 || showPastStops) return allDirectionStops;
    return allDirectionStops.filter((_, idx) => idx >= userStopIndex);
  }, [allDirectionStops, userStopCode, userStopIndex, showPastStops]);

  // Count of hidden past stops
  const pastStopCount = userStopCode && userStopIndex > 0 ? userStopIndex : 0;

  if (duraklar.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p>Bu hat için güzergah bilgisi bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Direction selector */}
      {directions.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {directions.map((dir) => {
            const stopsInDir = duraklar.filter((d) => d.YON === dir);
            const yonAdi = stopsInDir[0]?.YON_ADI;
            return (
              <button
                key={dir}
                onClick={() => setSelectedDirection(dir)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDirection === dir
                    ? 'bg-brand-soft-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {DIRECTION_LABELS[dir] || dir}{yonAdi ? ` - ${yonAdi}` : ''} ({stopsInDir.length} durak)
              </button>
            );
          })}
        </div>
      )}

      {/* User stop selector */}
      <div className="bg-brand-light-blue/20 border border-brand-soft-blue/20 rounded-xl p-3">
        <label className="text-xs font-medium text-gray-700 block mb-1.5">
          <CircleDot className="w-3.5 h-3.5 inline mr-1 text-brand-soft-blue" />
          Bulunduğunuz veya bineceğiniz durak
        </label>
        <select
          value={userStopCode || ''}
          onChange={(e) => {
            setUserStopCode(e.target.value || null);
            setShowPastStops(false);
          }}
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30 focus:border-brand-soft-blue"
        >
          <option value="">Durak seçin (tüm durakları göster)</option>
          {allDirectionStops.map((s) => (
            <option key={s.DURAKKODU} value={s.DURAKKODU}>
              {s.SIRANO}. {s.DURAKADI} ({s.DURAKKODU})
            </option>
          ))}
        </select>
      </div>

      {/* Route map */}
      {allDirectionStops.length > 0 && (
        <RouteMap duraklar={duraklar} selectedDirection={selectedDirection} />
      )}

      {/* Stops count + past stops toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {filteredStops.length} durak{pastStopCount > 0 && !showPastStops && (
            <span className="text-xs text-gray-400 ml-1">({pastStopCount} geçmiş durak gizlendi)</span>
          )}
        </div>
        {pastStopCount > 0 && (
          <button
            onClick={() => setShowPastStops((p) => !p)}
            className="text-xs text-brand-soft-blue hover:underline flex items-center gap-1"
          >
            {showPastStops ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Geçmiş durakları gizle</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Geçmiş durakları göster</>
            )}
          </button>
        )}
      </div>

      {/* Stops list - timeline style */}
      <div className="relative">
        {filteredStops.map((stop, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === filteredStops.length - 1;
          const isUserStop = stop.DURAKKODU === userStopCode;
          const hasBus = vehicleAtStopCodes.has(stop.DURAKKODU);
          const busesHere = vehicleByStopCode.get(stop.DURAKKODU);
          // Check if this stop is a past stop (shown in showPastStops mode)
          const globalIdx = allDirectionStops.findIndex((d) => d.DURAKKODU === stop.DURAKKODU);
          const isPast = userStopCode && userStopIndex > 0 && globalIdx < userStopIndex;

          return (
            <div key={`${stop.DURAKKODU}-${idx}`} className={`flex gap-3 group ${isPast ? 'opacity-40' : ''}`}>
              {/* Timeline line + dot */}
              <div className="flex flex-col items-center w-6 flex-shrink-0">
                <div
                  className={`w-0.5 flex-1 ${isFirst ? 'bg-transparent' : isPast ? 'bg-gray-100' : 'bg-gray-200'}`}
                />
                <div
                  className={`rounded-full flex-shrink-0 border-2 flex items-center justify-center ${
                    hasBus
                      ? 'w-5 h-5 bg-green-500 border-green-500'
                      : isUserStop
                        ? 'w-4 h-4 bg-brand-orange border-brand-orange'
                        : isFirst || isLast
                          ? 'w-3 h-3 bg-brand-soft-blue border-brand-soft-blue'
                          : 'w-3 h-3 bg-white border-gray-300 group-hover:border-brand-soft-blue'
                  }`}
                >
                  {hasBus && (
                    <Bus className="w-3 h-3 text-white" />
                  )}
                </div>
                <div
                  className={`w-0.5 flex-1 ${isLast ? 'bg-transparent' : isPast ? 'bg-gray-100' : 'bg-gray-200'}`}
                />
              </div>

              {/* Stop info */}
              <div className={`flex-1 pb-3 ${isLast ? 'pb-0' : ''}`}>
                <Link
                  href={`/otobus-duraklari/${buildDurakSlug(stop.DURAKADI, stop.DURAKKODU)}`}
                  className={`block border rounded-lg p-3 transition-all ${
                    hasBus
                      ? 'bg-green-50 border-green-200 shadow-sm'
                      : isUserStop
                        ? 'bg-orange-50 border-brand-orange/30 shadow-sm'
                        : 'bg-white border-gray-100 group-hover:border-brand-soft-blue/30 group-hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`font-medium text-sm transition-colors ${
                        hasBus
                          ? 'text-green-700'
                          : isUserStop
                            ? 'text-brand-orange'
                            : 'text-gray-900 group-hover:text-brand-soft-blue'
                      }`}>
                        {stop.DURAKADI}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-1">
                        <span className="font-mono">{stop.DURAKKODU}</span>
                        {stop.ILCEADI && (
                          <>
                            <span>•</span>
                            <span>{stop.ILCEADI}</span>
                          </>
                        )}
                      </div>
                      {hasBus && busesHere && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {busesHere.map((b) => (
                            <span key={b.kapino} className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                              <Bus className="w-3 h-3" />
                              {b.kapino}
                            </span>
                          ))}
                        </div>
                      )}
                      {isUserStop && (
                        <span className="inline-block mt-1.5 text-xs text-brand-orange font-medium">📍 Bulunduğunuz durak</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono flex-shrink-0">
                      {stop.SIRANO}
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
