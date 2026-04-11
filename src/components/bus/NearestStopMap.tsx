'use client';

import { useEffect, useRef, useState } from 'react';
import type { IETTDurakDetay, IETTHatOtoKonum } from '@/types/iett';

interface NearestStopMapProps {
  userLat: number;
  userLng: number;
  stop: IETTDurakDetay;
  selectedVehicle: IETTHatOtoKonum | null;
  otherVehicles: IETTHatOtoKonum[];
  routeStops?: IETTDurakDetay[];
  allDuraklar?: IETTDurakDetay[];
}

const ROUTE_COLOR = '#facc15'; // yellow like arac.iett.gov.tr
const STOP_COLOR = '#22c55e';  // green for stop labels

export default function NearestStopMap({
  userLat,
  userLng,
  stop,
  selectedVehicle,
  otherVehicles,
  routeStops,
  allDuraklar,
}: NearestStopMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const staticLayerRef = useRef<any>(null);
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

  // Static layer: route polyline + user marker (drawn once, or when stop/route changes)
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    if (staticLayerRef.current) {
      map.removeLayer(staticLayerRef.current);
    }

    const group = L.featureGroup();

    // Route polyline (yellow dashed)
    if (routeStops && routeStops.length > 1) {
      const sorted = [...routeStops].sort((a, b) => a.SIRANO - b.SIRANO);
      const latlngs = sorted.map((s) => [s.YKOORDINATI, s.XKOORDINATI] as [number, number]);
      L.polyline(latlngs, { color: ROUTE_COLOR, weight: 5, opacity: 0.6, dashArray: '10 6' }).addTo(group);

      // Show dots with small name labels on the route line
      sorted.forEach((s) => {
        L.circleMarker([s.YKOORDINATI, s.XKOORDINATI], {
          radius: 2.5,
          fillColor: ROUTE_COLOR,
          color: 'rgba(255,255,255,0.3)',
          weight: 1,
          fillOpacity: 0.6,
        }).addTo(group);

        // Small stop name label
        const smallLabel = L.divIcon({
          className: 'leaflet-stop-label',
          html: `<div style="
            color:rgba(255,255,255,0.45);
            font-size:8px;
            font-weight:400;
            white-space:nowrap;
            pointer-events:none;
            position:absolute;
            left:50%;
            bottom:2px;
            transform:translateX(-50%);
          ">${s.DURAKADI}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker([s.YKOORDINATI, s.XKOORDINATI], { icon: smallLabel, interactive: false }).addTo(group);
      });
    }

    // User marker (blue pulsing dot)
    const userIcon = L.divIcon({
      className: 'leaflet-stop-label',
      html: `<div style="
        width:18px;height:18px;
        background:#3b82f6;
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 0 0 4px rgba(59,130,246,0.4), 0 2px 6px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([userLat, userLng], { icon: userIcon })
      .bindPopup('<strong style="color:#333">Konumunuz</strong>', { closeButton: false })
      .addTo(group);

    group.addTo(map);
    staticLayerRef.current = group;
  }, [userLat, userLng, stop, routeStops, isLoaded]);

  // Vehicle layer: shows labeled stops between vehicle & user, vehicle markers, auto-zoom
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !isLoaded) return;

    if (vehicleLayerRef.current) {
      map.removeLayer(vehicleLayerRef.current);
    }

    const group = L.featureGroup();
    const focusBounds = L.featureGroup();

    // Determine key stops to label: vehicle's stop, next stop, and user's stop
    let labelStops: { stop: IETTDurakDetay; type: 'vehicle' | 'next' | 'user' }[] = [];
    const sorted = routeStops && routeStops.length > 1
      ? [...routeStops].sort((a, b) => a.SIRANO - b.SIRANO)
      : [];

    // User's nearest stop (always shown)
    labelStops.push({ stop, type: 'user' });

    if (selectedVehicle?.yakinDurakKodu && sorted.length > 0) {
      let vehicleIdx = sorted.findIndex((s) => s.DURAKKODU === selectedVehicle.yakinDurakKodu);
      const userIdx = sorted.findIndex((s) => s.DURAKKODU === stop.DURAKKODU);

      // If vehicle stop not in route direction, look up from all duraklar
      let vehicleStopFromAll: IETTDurakDetay | undefined;
      if (vehicleIdx === -1 && allDuraklar) {
        vehicleStopFromAll = allDuraklar.find((d) => d.DURAKKODU === selectedVehicle.yakinDurakKodu);
      }

      if (vehicleIdx !== -1) {
        if (sorted[vehicleIdx].DURAKKODU !== stop.DURAKKODU) {
          labelStops.push({ stop: sorted[vehicleIdx], type: 'vehicle' });
        }
        const nextIdx = userIdx > vehicleIdx ? vehicleIdx + 1 : vehicleIdx - 1;
        if (nextIdx >= 0 && nextIdx < sorted.length && sorted[nextIdx].DURAKKODU !== stop.DURAKKODU && sorted[nextIdx].DURAKKODU !== selectedVehicle.yakinDurakKodu) {
          labelStops.push({ stop: sorted[nextIdx], type: 'next' });
        }
      } else if (vehicleStopFromAll) {
        // Vehicle is on a different direction — still show its stop label
        labelStops.push({ stop: vehicleStopFromAll, type: 'vehicle' });
      }
    }

    // Draw labeled stops
    labelStops.forEach(({ stop: s, type }) => {
      const bgColor = type === 'user' ? STOP_COLOR : type === 'vehicle' ? '#f97316' : '#a78bfa';
      const shadow = 'box-shadow:0 2px 8px rgba(0,0,0,0.5);';

      const labelIcon = L.divIcon({
        className: 'leaflet-stop-label',
        html: `<div style="
          background:${bgColor};
          color:#fff;
          font-size:11px;
          font-weight:700;
          padding:3px 8px;
          border-radius:4px;
          white-space:nowrap;
          pointer-events:auto;
          border:1px solid rgba(255,255,255,0.25);
          position:absolute;
          left:50%;
          bottom:4px;
          transform:translateX(-50%);
          ${shadow}
        ">${type === 'next' ? '→ ' : ''}${s.DURAKADI}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([s.YKOORDINATI, s.XKOORDINATI], { icon: labelIcon, interactive: false }).addTo(group);

      L.circleMarker([s.YKOORDINATI, s.XKOORDINATI], {
        radius: 5,
        fillColor: bgColor,
        color: '#fff',
        weight: 1.5,
        fillOpacity: 1,
      }).addTo(group);
    });

    // Other vehicles (gray badge)
    otherVehicles.forEach((v) => {
      const lat = parseFloat(v.enlem);
      const lng = parseFloat(v.boylam);
      if (!isFinite(lat) || !isFinite(lng)) return;

      const icon = L.divIcon({
        className: 'leaflet-stop-label',
        html: `<div style="
          background:#6b7280;
          color:#fff;
          font-size:10px;
          font-weight:700;
          padding:2px 6px;
          border-radius:4px;
          border:2px solid rgba(255,255,255,0.3);
          white-space:nowrap;
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          display:flex;align-items:center;gap:3px;
        ">🚌 ${v.kapino}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([lat, lng], { icon }).addTo(group);
    });

    // Selected vehicle (yellow badge)
    if (selectedVehicle) {
      const vLat = parseFloat(selectedVehicle.enlem);
      const vLng = parseFloat(selectedVehicle.boylam);
      if (isFinite(vLat) && isFinite(vLng)) {
        const busIcon = L.divIcon({
          className: 'leaflet-stop-label',
          html: `<div style="
            background:#facc15;
            color:#1a1a1a;
            font-size:12px;
            font-weight:800;
            padding:4px 10px;
            border-radius:6px;
            border:2px solid #fff;
            box-shadow:0 0 12px rgba(250,204,21,0.5), 0 2px 8px rgba(0,0,0,0.4);
            white-space:nowrap;
            position:absolute;
            left:50%;
            top:50%;
            transform:translate(-50%,-50%);
            display:flex;align-items:center;gap:4px;
          ">🚌 ${selectedVehicle.kapino}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
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

        L.marker([vLat, vLng]).addTo(focusBounds);
      }
    }

    group.addTo(map);
    vehicleLayerRef.current = group;

    // Auto-zoom: only vehicle + user's nearest stop
    L.marker([stop.YKOORDINATI, stop.XKOORDINATI]).addTo(focusBounds);
    if (focusBounds.getLayers().length < 2) {
      L.marker([userLat, userLng]).addTo(focusBounds);
    }
    map.fitBounds(focusBounds.getBounds(), { padding: [80, 80], maxZoom: 15, animate: true });
  }, [selectedVehicle, otherVehicles, stop, userLat, userLng, routeStops, allDuraklar, isLoaded]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-[300px] md:h-[400px] border border-gray-700 rounded-xl overflow-hidden"
      style={{ background: '#1a1a2e' }}
    />
  );
}
