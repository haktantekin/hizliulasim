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
    const container = mapContainerRef.current;
    if (!container) return;

    // Prevent re-initialization (Strict Mode double-invoke)
    if (mapRef.current) return;

    // Guard: if Leaflet already attached a map to this DOM node, clean it up
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
      container.innerHTML = '';
    }

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled) return;
      if (mapRef.current) return;
      if ((container as any)._leaflet_id) return;

      // Load CSS
      if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Custom styles for stop labels
      if (typeof window !== 'undefined' && !document.getElementById('leaflet-stop-label-css')) {
        const style = document.createElement('style');
        style.id = 'leaflet-stop-label-css';
        style.textContent = `.leaflet-stop-label { background: none !important; border: none !important; overflow: visible !important; }`;
        document.head.appendChild(style);
      }

      leafletRef.current = L;

      const map = L.map(container, {
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '',
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
      opacity: 0.7,
    }).addTo(group);

    // Stop markers with name labels
    stops.forEach((stop, idx) => {
      const isTerminal = idx === 0 || idx === stops.length - 1;

      // Circle marker
      L.circleMarker([stop.YKOORDINATI, stop.XKOORDINATI], {
        radius: isTerminal ? 7 : 3.5,
        fillColor: isTerminal ? color : '#fff',
        color,
        weight: isTerminal ? 3 : 2,
        opacity: 1,
        fillOpacity: 1,
      })
        .bindPopup(
          `<div style="font-size:13px;min-width:140px">
            <strong>${stop.DURAKADI}</strong><br/>
            <span style="color:#666;font-size:11px">${stop.SIRANO}. durak • ${stop.DURAKKODU}</span>
            ${stop.ILCEADI ? `<br/><span style="color:#999;font-size:11px">${stop.ILCEADI}</span>` : ''}
          </div>`,
          { closeButton: false }
        )
        .on('mouseover', function (this: any) { this.openPopup(); })
        .addTo(group);

      // Name label
      const fontSize = isTerminal ? '11px' : '9px';
      const fontWeight = isTerminal ? '700' : '500';
      const textColor = isTerminal ? color : '#555';
      const bg = isTerminal ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)';
      const padding = isTerminal ? '2px 6px' : '1px 4px';
      const shadow = isTerminal ? 'box-shadow:0 1px 4px rgba(0,0,0,0.15);' : '';
      const arrow = isTerminal ? (idx === 0 ? '▶ ' : '◀ ') : '';

      const labelIcon = L.divIcon({
        className: 'leaflet-stop-label',
        html: `<div style="
          color:${textColor};
          font-size:${fontSize};
          font-weight:${fontWeight};
          background:${bg};
          padding:${padding};
          border-radius:3px;
          white-space:nowrap;
          pointer-events:none;
          position:absolute;
          left:50%;
          bottom:4px;
          transform:translateX(-50%);
          ${shadow}
        ">${arrow}${stop.DURAKADI}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([stop.YKOORDINATI, stop.XKOORDINATI], { icon: labelIcon, interactive: false }).addTo(group);
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
