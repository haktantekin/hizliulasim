'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { IETTDurakDetay } from '@/types/iett';
import MapFullscreenFrame from '@/components/maps/MapFullscreenFrame';
import { compactLeafletAttribution, OPENSTREETMAP_ATTRIBUTION, OPENSTREETMAP_TILE_URL } from '@/lib/maps/leafletAttribution';
import type { RouteMap3DProps } from './route-map-journey';

const COLORS: Record<string, string> = {
  D: '#304269',
  G: '#6bb88c',
};

function validPosition(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

function stopPopup(stop: IETTDurakDetay) {
  const content = document.createElement('div');
  content.className = 'min-w-[140px] text-[13px]';

  const name = document.createElement('strong');
  name.className = 'block';
  name.textContent = stop.DURAKADI;

  const detail = document.createElement('span');
  detail.className = 'block text-[11px] text-gray-600';
  detail.textContent = `${stop.SIRANO}. durak • ${stop.DURAKKODU}`;
  content.append(name, detail);

  if (stop.ILCEADI) {
    const district = document.createElement('span');
    district.className = 'block text-[11px] text-gray-500';
    district.textContent = stop.ILCEADI;
    content.append(district);
  }

  return content;
}

function stopLabel(stop: IETTDurakDetay, terminal: boolean, first: boolean, color: string) {
  const label = document.createElement('div');
  label.className = `pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[3px] ${
    terminal ? 'bg-white/90 px-1.5 py-0.5 text-[11px] font-bold shadow' : 'bg-white/70 px-1 py-px text-[9px] font-medium text-gray-600'
  }`;
  if (terminal) label.style.color = color;
  const arrow = terminal ? (first ? '▶ ' : '◀ ') : '';
  label.textContent = arrow + stop.DURAKADI;

  return L.divIcon({ className: 'route-map-stop-label', html: label, iconSize: [0, 0], iconAnchor: [0, 0] });
}

export default function RouteMap2D({ duraklar, selectedDirection, path }: RouteMap3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: L.Map; route: L.FeatureGroup } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { scrollWheelZoom: false });
    compactLeafletAttribution(map);
    L.tileLayer(OPENSTREETMAP_TILE_URL, {
      maxZoom: 18,
      attribution: OPENSTREETMAP_ATTRIBUTION,
    }).addTo(map);
    mapRef.current = { map, route: L.featureGroup().addTo(map) };

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const { map, route } = mapRef.current;
    route.clearLayers();

    const stops = duraklar
      .filter((stop) => stop.YON === selectedDirection && validPosition(stop.YKOORDINATI, stop.XKOORDINATI))
      .sort((a, b) => a.SIRANO - b.SIRANO);
    const color = COLORS[selectedDirection] ?? COLORS.D;
    const coordinates = path?.coordinates.filter(([lat, lng]) => validPosition(lat, lng)) ?? [];

    if (coordinates.length >= 2) {
      L.polyline(coordinates, {
        color,
        weight: 5,
        opacity: 0.85,
        ...(path?.quality === 'approximate' ? { dashArray: '9 8' } : {}),
      }).addTo(route);
    }

    stops.forEach((stop, index) => {
      const terminal = index === 0 || index === stops.length - 1;
      const position: L.LatLngTuple = [stop.YKOORDINATI, stop.XKOORDINATI];
      const marker = L.circleMarker(position, {
        radius: terminal ? 7 : 3.5,
        fillColor: terminal ? color : '#fff',
        color,
        weight: terminal ? 3 : 2,
        opacity: 1,
        fillOpacity: 1,
      }).bindPopup(stopPopup(stop), { closeButton: false });
      marker.on('mouseover', () => marker.openPopup()).addTo(route);
      L.marker(position, {
        icon: stopLabel(stop, terminal, index === 0, color),
        interactive: false,
        keyboard: false,
      }).addTo(route);
    });

    const bounds = route.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
    } else {
      map.setView([41.015, 28.979], 10);
    }
  }, [duraklar, selectedDirection, path]);

  return (
    <MapFullscreenFrame onFullscreenChange={() => mapRef.current?.map.invalidateSize()}>
      <div
        ref={containerRef}
        aria-label="2B güzergâh haritası"
        className="map-fullscreen-canvas h-[300px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 md:h-[400px]"
      />
      {path?.quality === 'approximate' && (
        <div className="absolute bottom-2 left-2 z-[500] rounded-md bg-white/95 px-2 py-1 text-[11px] text-gray-600 shadow">
          Kesik çizgi: duraklardan oluşturulan yaklaşık güzergâh
        </div>
      )}
    </MapFullscreenFrame>
  );
}
