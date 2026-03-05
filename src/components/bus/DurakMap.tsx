'use client';

import { useEffect, useRef, useState } from 'react';

interface DurakMapProps {
  lat: number;
  lng: number;
  durakAdi: string;
}

export default function DurakMap({ lat, lng, durakAdi }: DurakMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    if (mapRef.current) return;

    // Clear stale leaflet id from Strict Mode re-mount
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || mapRef.current) return;

      // Load CSS once
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = L.map(container, {
        scrollWheelZoom: false,
        zoomControl: true,
        dragging: true,
      }).setView([lat, lng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Custom bus stop icon
      const stopIcon = L.divIcon({
        className: '',
        html: `<div style="
          display:flex;align-items:center;justify-content:center;
          width:36px;height:36px;
          background:linear-gradient(135deg,#304269,#4a6fa5);
          border:3px solid #fff;
          border-radius:50%;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      });

      L.marker([lat, lng], { icon: stopIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:13px;text-align:center;min-width:120px">
            <strong>${durakAdi}</strong>
          </div>`,
          { closeButton: false }
        )
        .openPopup();

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
  }, [lat, lng, durakAdi]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[250px] md:h-[300px] border border-gray-200 rounded-xl overflow-hidden"
      style={{ background: isLoaded ? 'transparent' : '#f3f4f6' }}
    />
  );
}
