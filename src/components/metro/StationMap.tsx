'use client';

import { useEffect, useRef, useState } from 'react';
import type { MetroStation } from '@/types/metro';

interface StationMapProps {
  stations: MetroStation[];
  lineColor: string;
}

function parseCoord(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export default function StationMap({ stations, lineColor }: StationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map — exact RouteMap pattern ([] deps, no setView, triple guard)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Prevent re-initialization (Strict Mode double-invoke)
    if (mapRef.current) return;

    // Guard: if Leaflet already attached a map to this DOM node, bail out
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
      container.innerHTML = '';
    }

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled) return;
      if (mapRef.current) return;
      if ((container as any)._leaflet_id) return;

      leafletRef.current = L;

      const map = L.map(container, {
        scrollWheelZoom: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* strict mode teardown */ }
        mapRef.current = null;
      }
      setIsLoaded(false);
    };
  }, []);

  // Draw / redraw stations — runs when data arrives or changes
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    // Remove old layer
    if (layerRef.current) {
      try { map.removeLayer(layerRef.current); } catch { /* noop */ }
    }

    if (!stations || stations.length === 0) return;

    const valid: { name: string; lat: number; lng: number }[] = [];
    for (const s of stations) {
      const lat = parseCoord(s.DetailInfo?.Latitude ?? (s as any).Latitude);
      const lng = parseCoord(s.DetailInfo?.Longitude ?? (s as any).Longitude);
      if (lat !== null && lng !== null) {
        valid.push({ name: s.Description || s.Name, lat, lng });
      }
    }
    if (valid.length === 0) return;

    try {
      const group = L.featureGroup();

      // Polyline
      const coords = valid.map(v => [v.lat, v.lng] as [number, number]);
      L.polyline(coords, { color: lineColor, weight: 4, opacity: 0.8 }).addTo(group);

      // Station markers
      valid.forEach((v, i) => {
        L.circleMarker([v.lat, v.lng] as [number, number], {
          radius: 6,
          fillColor: '#fff',
          color: lineColor,
          weight: 3,
          fillOpacity: 1,
        })
          .bindPopup(
            `<div style="font-size:13px;font-weight:600">${v.name}</div>
             <div style="font-size:11px;color:#888">İstasyon ${i + 1}</div>`
          )
          .addTo(group);
      });

      group.addTo(map);
      layerRef.current = group;

      // Fit bounds
      map.fitBounds(group.getBounds(), { padding: [30, 30] });
    } catch (e) {
      // Leaflet can throw during strict mode transitions — suppress
      console.warn('StationMap draw:', e);
    }
  }, [stations, lineColor, isLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[350px] rounded-xl overflow-hidden border border-gray-100"
    />
  );
}
