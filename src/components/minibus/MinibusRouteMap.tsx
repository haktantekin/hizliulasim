'use client';

import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

import type { MinibusRoutePoint } from '@/lib/minibusData';

export default function MinibusRouteMap({
  points,
  directionLabel,
  color,
}: {
  points: MinibusRoutePoint[];
  directionLabel: string;
  color: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    if ('_leaflet_id' in container) {
      (container as HTMLDivElement & { _leaflet_id?: number | null })._leaflet_id = null;
      container.innerHTML = '';
    }

    let cancelled = false;
    import('leaflet').then((leaflet) => {
      if (cancelled || mapRef.current || !containerRef.current) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = leaflet.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
      });
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      map.setView([41.0082, 28.9784], 10);

      leafletRef.current = leaflet;
      mapRef.current = map;
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
      layerRef.current?.remove();
      layerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      setIsLoaded(false);
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || !isLoaded || points.length === 0) return;

    layerRef.current?.remove();
    const group = leaflet.layerGroup();
    const coordinates = points.map(({ lat, lng }) => [lat, lng] as [number, number]);

    leaflet.polyline(coordinates, {
      color,
      weight: 5,
      opacity: 0.82,
      lineJoin: 'round',
    }).addTo(group);

    const endpoints = [
      { point: points[0], label: `${directionLabel} başlangıcı`, filled: true },
      { point: points.at(-1), label: `${directionLabel} bitişi`, filled: false },
    ];
    for (const endpoint of endpoints) {
      if (!endpoint.point) continue;
      leaflet.circleMarker([endpoint.point.lat, endpoint.point.lng], {
        radius: 8,
        color,
        weight: 3,
        fillColor: endpoint.filled ? color : '#ffffff',
        fillOpacity: 1,
      }).bindTooltip(endpoint.label).addTo(group);
    }

    group.addTo(map);
    layerRef.current = group;
    if (coordinates.length === 1) {
      map.setView(coordinates[0], 15);
    } else {
      map.fitBounds(leaflet.latLngBounds(coordinates), { padding: [28, 28] });
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [color, directionLabel, isLoaded, points]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`${directionLabel} minibüs güzergâh haritası`}
      className="h-[340px] w-full overflow-hidden rounded-xl border border-gray-200 md:h-[440px]"
      style={{ background: isLoaded ? 'transparent' : '#f3f4f6' }}
    />
  );
}
