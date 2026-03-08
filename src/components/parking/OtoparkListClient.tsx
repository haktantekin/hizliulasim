'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ISPARKPark, ISPARKParkDetay } from '@/types/ispark';
import { Search, X, Loader2, Car, MapPin, Clock, ParkingCircle, ChevronDown, ChevronUp } from 'lucide-react';

type ParkTypeFilter = 'ALL' | 'AÇIK OTOPARK' | 'KAPALI OTOPARK' | 'YOL ÜSTÜ';

function OtoparkDetayPanel({ parkId, onClose }: { parkId: number; onClose: () => void }) {
  const [detay, setDetay] = useState<ISPARKParkDetay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetay() {
      try {
        setLoading(true);
        const res = await fetch(`/api/ispark/detay?id=${parkId}`);
        if (!res.ok) throw new Error('API error');
        const data: ISPARKParkDetay = await res.json();
        if (!cancelled) setDetay(data);
      } catch {
        if (!cancelled) setDetay(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDetay();
    return () => { cancelled = true; };
  }, [parkId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Detaylar yükleniyor...</span>
      </div>
    );
  }

  if (!detay) {
    return (
      <div className="p-4 text-sm text-gray-500">Detay bilgisi alınamadı.</div>
    );
  }

  return (
    <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-3 text-sm">
      {detay.address && (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span className="text-gray-700">{detay.address}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {detay.tariff && (
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Tarife</div>
            <div className="font-semibold text-gray-900">{detay.tariff}</div>
          </div>
        )}
        {detay.monthlyFee > 0 && (
          <div className="bg-white rounded-lg p-3 border border-gray-100">
            <div className="text-xs text-gray-500 mb-1">Aylık Abonelik</div>
            <div className="font-semibold text-brand-soft-blue">
              {detay.monthlyFee.toLocaleString('tr-TR')} ₺
            </div>
          </div>
        )}
      </div>
      {detay.updateDate && (
        <div className="text-xs text-gray-400">
          Son güncelleme: {detay.updateDate}
        </div>
      )}
      <button
        onClick={onClose}
        className="text-xs text-brand-soft-blue hover:underline"
      >
        Detayları gizle
      </button>
    </div>
  );
}

export default function OtoparkListClient() {
  const [parks, setParks] = useState<ISPARKPark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<ParkTypeFilter>('ALL');
  const [showCount, setShowCount] = useState(30);
  const [expandedParkId, setExpandedParkId] = useState<number | null>(null);

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

  const districts = useMemo(() => {
    const set = new Set(parks.map(p => p.district).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [parks]);

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
    return result;
  }, [parks, search, districtFilter, typeFilter]);

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

  const toggleExpand = useCallback((parkId: number) => {
    setExpandedParkId(prev => (prev === parkId ? null : parkId));
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
              const isExpanded = expandedParkId === park.parkID;

              return (
                <div
                  key={park.parkID}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-brand-soft-blue/30 hover:shadow-sm transition-all"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleExpand(park.parkID)}
                  >
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
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
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

                  {/* Expandable detail panel */}
                  {isExpanded && (
                    <OtoparkDetayPanel
                      parkId={park.parkID}
                      onClose={() => setExpandedParkId(null)}
                    />
                  )}
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
  );
}
