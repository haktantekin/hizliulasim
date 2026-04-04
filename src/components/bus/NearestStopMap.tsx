'use client';

import { useEffect, useRef, useState } from 'react';
import type { IETTDurakDetay, IETTHatOtoKonum } from '@/types/iett';

interface NearestStopMapProps {
  userLat: number;
  userLng: number;
  stop: IETTDurakDetay;
  selectedVehicle: IETTHatOtoKonum | null;
  otherVehicles: IETTHatOtoKonum[];
}

export default function NearestStopMap({
  userLat,
  userLng,
  stop,
  selectedVehicle,
  otherVehicles,
}: NearestStopMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
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

      // CSS once
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

  // Update markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const group = L.featureGroup();

    // User marker (blue pulsing dot)
    const userIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:20px;height:20px;
        background:#3b82f6;
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 4px rgba(59,130,246,0.3), 0 2px 6px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    L.marker([userLat, userLng], { icon: userIcon })
      .bindPopup('<strong>Konumunuz</strong>', { closeButton: false })
      .addTo(group);

    // Stop marker (orange pin)
    const stopIcon = L.divIcon({
      className: '',
      html: `<div style="
        display:flex;align-items:center;justify-content:center;
        width:36px;height:36px;
        background:linear-gradient(135deg,#f97316,#ea580c);
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
    L.marker([stop.YKOORDINATI, stop.XKOORDINATI], { icon: stopIcon })
      .bindPopup(
        `<div style="font-size:13px;min-width:140px">
          <strong>${stop.DURAKADI}</strong><br/>
          <span style="color:#666;font-size:11px">${stop.SIRANO}. durak • ${stop.DURAKKODU}</span>
        </div>`,
        { closeButton: false }
      )
      .addTo(group);

    // Other vehicles (gray, small)
    const otherBusIcon = L.divIcon({
      className: '',
      html: `<div style="
        display:flex;align-items:center;justify-content:center;
        width:24px;height:24px;
        background:#9ca3af;
        border:2px solid #fff;
        border-radius:50%;
        box-shadow:0 1px 4px rgba(0,0,0,0.2);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
          <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
        </svg>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    otherVehicles.forEach((v) => {
      const lat = parseFloat(v.enlem);
      const lng = parseFloat(v.boylam);
      if (!isFinite(lat) || !isFinite(lng)) return;
      L.marker([lat, lng], { icon: otherBusIcon })
        .bindPopup(`<span style="font-size:12px">${v.kapino}</span>`, { closeButton: false })
        .addTo(group);
    });

    // Selected vehicle (green, larger)
    if (selectedVehicle) {
      const vLat = parseFloat(selectedVehicle.enlem);
      const vLng = parseFloat(selectedVehicle.boylam);
      if (isFinite(vLat) && isFinite(vLng)) {
        const busIcon = L.divIcon({
          className: '',
          html: `<div style="
            display:flex;align-items:center;justify-content:center;
            width:36px;height:36px;
            background:linear-gradient(135deg,#16a34a,#15803d);
            border:3px solid #fff;
            border-radius:50%;
            box-shadow:0 0 0 3px rgba(22,163,74,0.3), 0 2px 8px rgba(0,0,0,0.3);
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
              <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
              <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
            </svg>
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([vLat, vLng], { icon: busIcon })
          .bindPopup(
            `<div style="font-size:13px">
              <strong>Yaklaşan Otobüs</strong><br/>
              <span style="color:#666;font-size:11px">Kapı No: ${selectedVehicle.kapino}</span>
            </div>`,
            { closeButton: false }
          )
          .addTo(group);
      }
    }

    group.addTo(map);
    layerRef.current = group;
    map.fitBounds(group.getBounds(), { padding: [40, 40] });
  }, [userLat, userLng, stop, selectedVehicle, otherVehicles, isLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[250px] md:h-[300px] border border-gray-200 rounded-xl overflow-hidden"
      style={{ background: isLoaded ? 'transparent' : '#f3f4f6' }}
    />
  );
}
