'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { IETTDurakDetay, IETTHatOtoKonum } from '@/types/iett';

interface LiveVehicleMapProps {
  duraklar: IETTDurakDetay[];
  konumlar: IETTHatOtoKonum[];
}

const COLORS: Record<string, string> = {
  D: '#304269',
  G: '#6bb88c',
};

export default function LiveVehicleMap({ duraklar, konumlar }: LiveVehicleMapProps) {
  const directions = useMemo(() => {
    const dirSet = new Set(duraklar.map((d) => d.YON));
    return Array.from(dirSet);
  }, [duraklar]);

  const [selectedDirection, setSelectedDirection] = useState<string>('D');

  useEffect(() => {
    if (directions.length > 0 && !directions.includes(selectedDirection)) {
      setSelectedDirection(directions[0]);
    }
  }, [directions, selectedDirection]);

  const DIRECTION_LABELS: Record<string, string> = { D: 'Gidiş', G: 'Dönüş' };

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map once
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapRef.current) return;
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
      container.innerHTML = '';
    }

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || mapRef.current) return;
      if ((container as any)._leaflet_id) return;

      if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      leafletRef.current = L;

      const map = L.map(container, {
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setIsLoaded(false);
    };
  }, []);

  // Draw route polyline + stops
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

    const stops = duraklar
      .filter((d) => d.YON === selectedDirection)
      .sort((a, b) => a.SIRANO - b.SIRANO);

    if (stops.length === 0) return;

    const group = L.featureGroup();
    const color = COLORS[selectedDirection] || '#304269';
    const latlngs = stops.map((s) => [s.YKOORDINATI, s.XKOORDINATI] as [number, number]);

    L.polyline(latlngs, { color, weight: 4, opacity: 0.5, dashArray: '8 4' }).addTo(group);

    stops.forEach((stop, idx) => {
      const isTerminal = idx === 0 || idx === stops.length - 1;
      L.circleMarker([stop.YKOORDINATI, stop.XKOORDINATI], {
        radius: isTerminal ? 6 : 3,
        fillColor: isTerminal ? color : '#ffffff',
        color,
        weight: isTerminal ? 3 : 1.5,
        opacity: 0.7,
        fillOpacity: 0.8,
      })
        .bindPopup(
          `<div style="font-size:12px"><strong>${stop.DURAKADI}</strong><br/><span style="color:#666">${stop.SIRANO}. durak</span></div>`,
          { closeButton: false }
        )
        .addTo(group);
    });

    group.addTo(map);
    routeLayerRef.current = group;
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
  }, [duraklar, selectedDirection, isLoaded]);

  // Update vehicle markers (runs on every konumlar change without re-drawing route)
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    if (vehicleLayerRef.current) {
      map.removeLayer(vehicleLayerRef.current);
    }

    const vehicles = konumlar.filter((v) => {
      const parts = v.guzergahkodu?.split('_');
      const dirCode = parts && parts.length >= 2 ? parts[1] : '';
      return dirCode === selectedDirection;
    });
    if (vehicles.length === 0) return;

    const group = L.featureGroup();

    // Build durak name lookup
    const durakMap = new Map<string, string>();
    for (const d of duraklar) {
      durakMap.set(d.DURAKKODU, d.DURAKADI);
    }

    vehicles.forEach((v) => {
      const lat = parseFloat(v.enlem);
      const lng = parseFloat(v.boylam);
      if (!isFinite(lat) || !isFinite(lng)) return;

      const yakinDurakAdi = durakMap.get(v.yakinDurakKodu) || v.yakinDurakKodu;
      const timeStr = v.son_konum_zamani ? v.son_konum_zamani.split(' ')[1]?.substring(0, 5) : '';

      // Bus icon using divIcon
      const busIcon = L.divIcon({
        className: 'live-bus-marker',
        html: `<div style="
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 6px;
          border-radius: 6px;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 3px;
          transform: translate(-50%, -50%);
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H6c-1.1 0-2.1.8-2.4 1.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2C2.5 16.3 3 18 3 18h3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
          ${v.kapino}
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([lat, lng], { icon: busIcon })
        .bindPopup(
          `<div style="font-size:12px;min-width:150px">
            <strong>🚌 ${v.kapino}</strong><br/>
            <span style="color:#666">Yakın Durak: ${yakinDurakAdi}</span>
            ${timeStr ? `<br/><span style="color:#999">Son Konum: ${timeStr}</span>` : ''}
          </div>`,
          { closeButton: false }
        )
        .addTo(group);
    });

    group.addTo(map);
    vehicleLayerRef.current = group;
  }, [konumlar, duraklar, selectedDirection, isLoaded]);

  return (
    <div className="space-y-2">
      {directions.length > 1 && (
        <div className="flex gap-2">
          {directions.map((dir) => (
            <button
              key={dir}
              onClick={() => setSelectedDirection(dir)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedDirection === dir
                  ? 'bg-brand-soft-blue text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {DIRECTION_LABELS[dir] || dir}
            </button>
          ))}
        </div>
      )}
      <div
        ref={mapContainerRef}
        className="w-full h-[350px] md:h-[450px] border border-gray-200 rounded-xl overflow-hidden"
        style={{ background: isLoaded ? 'transparent' : '#f3f4f6' }}
      />
    </div>
  );
}
