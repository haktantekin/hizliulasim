'use client';

import { useEffect, useState, useRef } from 'react';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Loader2, MapPin, List, Map as MapIcon } from 'lucide-react';
import type { ISPARKPark } from '@/types/ispark';

export default function EngelsizOtoparklarPage() {
  const [parks, setParks] = useState<ISPARKPark[]>([]);
  const [filteredParks, setFilteredParks] = useState<ISPARKPark[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    async function fetchParks() {
      try {
        const res = await fetch('/api/ispark', { cache: 'no-store' });
        if (!res.ok) throw new Error('Veri alınamadı');
        const data: ISPARKPark[] = await res.json();

        // İSPARK API'de engelli park yeri bilgisi doğrudan yok,
        // ancak parkType alanında veya isimde "ENGELLI" geçenleri filtreleyebiliriz.
        // Ayrıca tüm otoparkları gösterip engelli dostu bilgisiyle etiketleyebiliriz.
        setParks(data);

        const uniqueDistricts = [...new Set(data.map((p) => p.district).filter(Boolean))].sort();
        setDistricts(uniqueDistricts);
      } catch {
        setError('Otopark bilgisi alınamadı.');
      } finally {
        setLoading(false);
      }
    }
    fetchParks();
  }, []);

  useEffect(() => {
    let filtered = parks;
    if (selectedDistrict) {
      filtered = filtered.filter((p) => p.district === selectedDistrict);
    }
    // Sadece açık olan otoparkları göster
    filtered = filtered.filter((p) => p.isOpen === 1);
    setFilteredParks(filtered);
  }, [parks, selectedDistrict]);

  // Map rendering
  useEffect(() => {
    if (viewMode !== 'map' || loading || filteredParks.length === 0) return;

    const container = mapContainerRef.current;
    if (!container) return;

    if (mapRef.current && leafletRef.current) {
      updateMarkers(leafletRef.current, mapRef.current);
      return;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || mapRef.current) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = L.map(container, {
        scrollWheelZoom: true,
        zoomControl: true,
      }).setView([41.0082, 28.9784], 11);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);

      updateMarkers(L, map);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, loading]);

  useEffect(() => {
    if (viewMode === 'map' && mapRef.current && leafletRef.current) {
      updateMarkers(leafletRef.current, mapRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredParks]);

  function updateMarkers(L: any, map: any) {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    const parkIcon = L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#7c3aed;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:#fff;font-size:12px;font-weight:bold;">P</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });

    const bounds: [number, number][] = [];

    filteredParks.forEach((p) => {
      const lat = parseFloat(p.lat);
      const lng = parseFloat(p.lng);
      if (!lat || !lng) return;
      const pos: [number, number] = [lat, lng];
      bounds.push(pos);

      const occupancy = p.capacity > 0 ? Math.round(((p.capacity - p.emptyCapacity) / p.capacity) * 100) : 0;

      L.marker(pos, { icon: parkIcon })
        .addTo(markersRef.current)
        .bindPopup(
          `<div style="font-size:13px;min-width:160px">
            <strong>${p.parkName}</strong><br/>
            <span style="color:#666">${p.district || ''}</span><br/>
            <span>Kapasite: ${p.capacity} | Boş: ${p.emptyCapacity}</span><br/>
            <span>Doluluk: %${occupancy}</span><br/>
            <span style="color:#7c3aed">♿ Engelli park bilgisi için otoparka danışınız</span>
          </div>`
        );
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">♿</span>
          <h1 className="text-xl font-bold text-gray-900">Engelsiz Otoparklar</h1>
        </div>
        <p className="text-sm text-gray-500">
          İstanbul İSPARK otoparkları ve engelli park yeri bilgileri.
          Anlık doluluk durumu ve konum bilgileri.
        </p>
      </div>

      <Breadcrumb
        className="mb-4 -mt-2"
        items={[
          { label: 'Engelsiz Erişim', href: '/engelsiz-erisim' },
          { label: 'Engelsiz Otoparklar' },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-soft-blue"
        >
          <option value="">Tüm İlçeler</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-brand-dark-blue text-white' : 'bg-gray-100 text-gray-600'}`}
            aria-label="Liste görünümü"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`p-2 rounded-lg ${viewMode === 'map' ? 'bg-brand-dark-blue text-white' : 'bg-gray-100 text-gray-600'}`}
            aria-label="Harita görünümü"
          >
            <MapIcon size={18} />
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="text-sm text-gray-500 mb-4">
          <span className="font-semibold text-purple-600">{filteredParks.length}</span> otopark listeleniyor
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-soft-blue" />
          <span className="ml-2 text-gray-500">Otoparklar yükleniyor...</span>
        </div>
      )}

      {error && <div className="text-center py-12 text-red-500">{error}</div>}

      {!loading && !error && viewMode === 'map' && (
        <div
          ref={mapContainerRef}
          className="w-full h-[400px] md:h-[500px] border border-gray-200 rounded-xl overflow-hidden"
        />
      )}

      {!loading && !error && viewMode === 'list' && (
        <div className="space-y-2">
          {filteredParks.map((p) => {
            const occupancy = p.capacity > 0
              ? Math.round(((p.capacity - p.emptyCapacity) / p.capacity) * 100)
              : 0;
            const occupancyColor = occupancy > 80 ? 'text-red-500' : occupancy > 50 ? 'text-orange-500' : 'text-green-600';

            return (
              <div
                key={p.parkID}
                className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg"
              >
                <span className="text-purple-600 text-lg font-bold">P</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.parkName}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin size={12} />
                    {p.district || 'Bilinmiyor'}
                    <span className="ml-2">• Kapasite: {p.capacity}</span>
                    <span className={`ml-2 font-medium ${occupancyColor}`}>
                      Boş: {p.emptyCapacity}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.parkType} • {p.workHours}
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs bg-brand-dark-blue text-white rounded-full hover:opacity-90 shrink-0"
                >
                  Yol Tarifi
                </a>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-purple-50 rounded-lg text-sm text-purple-700">
        <p className="font-semibold mb-1">♿ Not</p>
        <p>
          İSPARK API&apos;sinde engelli park yeri sayısı ayrı olarak belirtilmemektedir.
          Engelli park yeri bilgisi için otoparkla doğrudan iletişime geçmenizi öneririz.
          Türkiye&apos;de tüm kamu otoparkları yasal olarak engelli park yeri ayırmakla yükümlüdür.
        </p>
      </div>
    </div>
  );
}
