'use client';

import { useEffect, useRef, useState } from 'react';
import type { IETTDurakDetay } from '@/types/iett';

interface RouteMapProps {
  duraklar: IETTDurakDetay[];
  selectedDirection: string;
}

// Brand colors
const COLORS: Record<string, string> = {
  D: '#304269', // soft-blue for Gidiş
  G: '#6bb88c', // green for Dönüş
};

export default function RouteMap({ duraklar, selectedDirection }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const leafletRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      // Load CSS
      if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      leafletRef.current = L;

      const map = L.map(mapContainerRef.current!, {
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers & polyline when direction changes
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    // Remove old layers
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const stops = duraklar
      .filter((d) => d.YON === selectedDirection)
      .sort((a, b) => a.SIRANO - b.SIRANO);

    if (stops.length === 0) return;

    const group = L.featureGroup();
    const color = COLORS[selectedDirection] || '#304269';

    // Coordinates for polyline
    const latlngs = stops.map((s) => [s.YKOORDINATI, s.XKOORDINATI] as [number, number]);

    // Polyline
    L.polyline(latlngs, {
      color,
      weight: 4,
      opacity: 0.8,
    }).addTo(group);

    // Stop markers
    stops.forEach((stop, idx) => {
      const isTerminal = idx === 0 || idx === stops.length - 1;
      const radius = isTerminal ? 8 : 4;
      const fillColor = isTerminal ? color : '#ffffff';
      const borderWeight = isTerminal ? 3 : 2;

      const circle = L.circleMarker([stop.YKOORDINATI, stop.XKOORDINATI], {
        radius,
        fillColor,
        color,
        weight: borderWeight,
        opacity: 1,
        fillOpacity: 1,
      }).addTo(group);

      circle.bindPopup(
        `<div style="font-size:13px;min-width:140px">
          <strong>${stop.DURAKADI}</strong><br/>
          <span style="color:#666;font-size:11px">${stop.SIRANO}. durak • ${stop.DURAKKODU}</span>
          ${stop.ILCEADI ? `<br/><span style="color:#999;font-size:11px">${stop.ILCEADI}</span>` : ''}
        </div>`,
        { closeButton: false }
      );

      circle.on('mouseover', function (this: any) {
        this.openPopup();
      });
    });

    group.addTo(map);
    layerRef.current = group;

    // Fit bounds with padding
    map.fitBounds(group.getBounds(), { padding: [30, 30] });
  }, [duraklar, selectedDirection, isLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[300px] md:h-[400px] border border-gray-200 rounded-xl overflow-hidden"
      style={{ background: isLoaded ? 'transparent' : '#f3f4f6' }}
    />
  );
}
