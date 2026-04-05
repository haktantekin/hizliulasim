'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ISPARKPark } from '@/types/ispark';
import { Search, X, Loader2, Car, MapPin, Clock, ParkingCircle, Heart } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { useUpdateFavorite } from '@/hooks/useAuth';
import AuthModal from '@/components/ui/AuthModal';

type ParkTypeFilter = 'ALL' | 'AÇIK OTOPARK' | 'KAPALI OTOPARK' | 'YOL ÜSTÜ';

interface NearestStopDistrict {
  ilceAdi: string;
}

interface ReverseDistrictResponse {
  city?: string;
  district?: string;
}

function normalizeDistrictName(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/\./g, '')
    .replace(/\s+il[çc]esi$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function OtoparkListClient() {
  const [parks, setParks] = useState<ISPARKPark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<ParkTypeFilter>('ALL');
  const [showCount, setShowCount] = useState(30);
  const [nearDistrict, setNearDistrict] = useState('');
  const [autoSelectedDistrict, setAutoSelectedDistrict] = useState('');
  const [districtAutoApplied, setDistrictAutoApplied] = useState(false);

  const { isAuthenticated, favorites } = useAppSelector((state) => state.user);
  const updateFavorite = useUpdateFavorite();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchParks() {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch('/api/ispark');
        if (!res.ok) throw new Error('API error');
        const data: ISPARKPark[] = await res.json();
        if (cancelled) return;
        data.sort((a, b) => a.parkName.localeCompare(b.parkName, 'tr'));
        setParks(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchParks();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          let ilce = '';

          const districtRes = await fetch(`/api/iett/yakin-durak?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`, {
            cache: 'no-store',
          });

          if (districtRes.ok) {
            const districtData: NearestStopDistrict = await districtRes.json();
            ilce = (districtData.ilceAdi || '').trim();
          }

          if (!ilce) {
            const reverseRes = await fetch(`/api/geocode/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`, {
              cache: 'no-store',
            });
            if (reverseRes.ok) {
              const reverseData: ReverseDistrictResponse = await reverseRes.json();
              ilce = (reverseData.district || '').trim();
            }
          }

          if (!cancelled && ilce) {
            setNearDistrict(ilce);
          }
        } catch {
          // Silent fallback: page still works with normal ordering
        }
      },
      () => {
        // Permission denied or location error; keep default list behavior
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const districts = useMemo(() => {
    const set = new Set(parks.map(p => p.district).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [parks]);

  useEffect(() => {
    if (districtAutoApplied) return;
    if (districtFilter !== 'ALL') return;
    if (!nearDistrict) return;
    if (districts.length === 0) return;

    const target = normalizeDistrictName(nearDistrict);
    const matched = districts.find((d) => {
      const norm = normalizeDistrictName(d);
      return norm === target || norm.includes(target) || target.includes(norm);
    });

    if (matched) {
      setDistrictFilter(matched);
      setAutoSelectedDistrict(matched);
      setDistrictAutoApplied(true);
      setShowCount(30);
    }
  }, [districtAutoApplied, districtFilter, nearDistrict, districts]);

  const parkTypes = useMemo(() => {
    const set = new Set(parks.map(p => p.parkType).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [parks]);

  const filteredParks = useMemo(() => {
    let result = parks;
    if (districtFilter !== 'ALL') {
      result = result.filter(p => p.district === districtFilter);
    }
    if (typeFilter !== 'ALL') {
      result = result.filter(p => p.parkType === typeFilter);
    }
    if (search.trim()) {
      const q = search.toUpperCase().trim();
      result = result.filter(
        p =>
          p.parkName.toUpperCase().includes(q) ||
          p.district.toUpperCase().includes(q)
      );
    }

    // If user has not selected a district manually, prioritize nearby district first.
    if (districtFilter === 'ALL' && nearDistrict) {
      const target = normalizeDistrictName(nearDistrict);
      result = [...result].sort((a, b) => {
        const aDistrict = normalizeDistrictName(a.district || '');
        const bDistrict = normalizeDistrictName(b.district || '');
        const aNear = aDistrict === target || aDistrict.includes(target) || target.includes(aDistrict);
        const bNear = bDistrict === target || bDistrict.includes(target) || target.includes(bDistrict);

        if (aNear !== bNear) return aNear ? -1 : 1;
        return a.parkName.localeCompare(b.parkName, 'tr');
      });
    }

    return result;
  }, [parks, search, districtFilter, typeFilter, nearDistrict]);

  const visibleParks = useMemo(
    () => filteredParks.slice(0, showCount),
    [filteredParks, showCount]
  );

  const stats = useMemo(() => {
    const total = filteredParks.length;
    const open = filteredParks.filter(p => p.isOpen === 1).length;
    const totalCapacity = filteredParks.reduce((s, p) => s + p.capacity, 0);
    const totalEmpty = filteredParks.reduce((s, p) => s + p.emptyCapacity, 0);
    return { total, open, totalCapacity, totalEmpty };
  }, [filteredParks]);

  const handleLoadMore = useCallback(() => {
    setShowCount(prev => prev + 30);
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    setShowCount(30);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Otopark bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Otopark bilgileri yüklenirken bir hata oluştu.</p>
        <p className="text-sm text-red-500 mt-1">Lütfen daha sonra tekrar deneyin.</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-brand-soft-blue">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">Toplam Otopark</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.open}</div>
          <div className="text-xs text-gray-500 mt-1">Açık Otopark</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalCapacity.toLocaleString('tr-TR')}</div>
          <div className="text-xs text-gray-500 mt-1">Toplam Kapasite</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-brand-orange">{stats.totalEmpty.toLocaleString('tr-TR')}</div>
          <div className="text-xs text-gray-500 mt-1">Boş Alan</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setShowCount(30);
            }}
            placeholder="Otopark adı veya ilçe ile arayın..."
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30 focus:border-brand-soft-blue"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={districtFilter}
            onChange={e => {
              setDistrictFilter(e.target.value);
              setShowCount(30);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30"
          >
            <option value="ALL">Tüm İlçeler</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value as ParkTypeFilter);
              setShowCount(30);
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30"
          >
            <option value="ALL">Tüm Tipler</option>
            {parkTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count */}
      <div className="text-sm text-gray-500 py-1">
        {search || districtFilter !== 'ALL' || typeFilter !== 'ALL' ? (
          <span>
            Filtreye uygun <strong>{filteredParks.length}</strong> otopark bulundu
          </span>
        ) : (
          <span>Toplam <strong>{parks.length}</strong> İSPARK otoparkı</span>
        )}
      </div>

      {districtFilter === 'ALL' && nearDistrict && (
        <div className="text-xs text-brand-soft-blue bg-brand-light-blue/20 border border-brand-light-blue/40 rounded-lg px-3 py-2">
          Konumuna gore <strong>{nearDistrict}</strong> ilcesindeki otoparklar once listeleniyor.
        </div>
      )}

      {districtFilter !== 'ALL' && autoSelectedDistrict && districtFilter === autoSelectedDistrict && (
        <div className="text-xs text-brand-soft-blue bg-brand-light-blue/20 border border-brand-light-blue/40 rounded-lg px-3 py-2">
          Konumuna gore ilce filtresi otomatik olarak <strong>{autoSelectedDistrict}</strong> secildi.
        </div>
      )}

      {/* Park List */}
      {filteredParks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Otopark bulunamadı</p>
          <p className="text-sm mt-1">Farklı bir arama terimi veya filtre deneyin</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {visibleParks.map(park => {
              const occupancyRate = park.capacity > 0
                ? ((park.capacity - park.emptyCapacity) / park.capacity) * 100
                : 0;

              return (
                <div
                  key={park.parkID}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-brand-soft-blue/30 hover:shadow-sm transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        park.isOpen === 1 ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        <ParkingCircle className="w-5 h-5" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                            {park.parkName}
                          </h3>
                          {(() => {
                            const isFav = isAuthenticated && favorites.places.some((p) => p.id === String(park.parkID));
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isAuthenticated) { setAuthModalOpen(true); return; }
                                  updateFavorite.mutate({
                                    type: 'places',
                                    action: isFav ? 'remove' : 'add',
                                    item: { id: String(park.parkID), name: park.parkName },
                                  });
                                }}
                                className="flex-shrink-0 p-1 rounded-full hover:bg-orange-50 transition-colors"
                                aria-label={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                              >
                                <Heart
                                  className={`w-4 h-4 transition-colors ${
                                    isFav
                                      ? 'text-brand-orange fill-brand-orange'
                                      : 'text-gray-300 hover:text-gray-400'
                                  }`}
                                />
                              </button>
                            );
                          })()}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1.5">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {park.district}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {park.workHours}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            park.parkType === 'KAPALI OTOPARK'
                              ? 'bg-blue-50 text-blue-700'
                              : park.parkType === 'AÇIK OTOPARK'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}>
                            {park.parkType}
                          </span>
                          {park.isOpen === 1 ? (
                            <span className="text-green-600 font-medium">Açık</span>
                          ) : (
                            <span className="text-red-500 font-medium">Kapalı</span>
                          )}
                        </div>

                        {/* Capacity Bar */}
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">
                              Doluluk: {park.capacity - park.emptyCapacity} / {park.capacity}
                            </span>
                            <span className={`font-semibold ${
                              occupancyRate > 90 ? 'text-red-600' : occupancyRate > 70 ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {park.emptyCapacity} boş
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                occupancyRate > 90 ? 'bg-red-500' : occupancyRate > 70 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                            />
                          </div>
                        </div>

                        {park.freeTime > 0 && (
                          <div className="mt-2 text-xs text-green-600 font-medium">
                            İlk {park.freeTime} dakika ücretsiz
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {showCount < filteredParks.length && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2.5 bg-brand-soft-blue text-white rounded-xl text-sm font-medium hover:bg-brand-dark-blue transition-colors"
              >
                Daha Fazla Göster ({filteredParks.length - showCount} otopark daha)
              </button>
            </div>
          )}
        </>
      )}
    </div>
    <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
