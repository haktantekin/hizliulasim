'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import MapFullscreenFrame from '@/components/maps/MapFullscreenFrame';
import { compactLeafletAttribution, OPENSTREETMAP_ATTRIBUTION, OPENSTREETMAP_TILE_URL } from '@/lib/maps/leafletAttribution';
import type { Toilet } from '@/lib/toilets/contracts';
import styles from './ToiletMap.module.css';

type Leaflet = typeof import('leaflet');
type Position = { lat: number; lng: number };
type Props = {
  toilets: Toilet[];
  position: Position | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function ToiletMap({ toilets, position, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [state, setState] = useState<{ leaflet: Leaflet; map: LeafletMap } | 'error' | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let map: LeafletMap | undefined;
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([leaflet]) => {
      if (cancelled) return;
      map = leaflet.map(container, { scrollWheelZoom: false });
      compactLeafletAttribution(map);
      mapRef.current = map;
      leaflet.tileLayer(OPENSTREETMAP_TILE_URL, {
        maxZoom: 19,
        className: styles.tiles,
        attribution: OPENSTREETMAP_ATTRIBUTION,
      }).addTo(map);
      setState({ leaflet, map });
    }).catch(() => {
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
      if (mapRef.current === map) mapRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!state || state === 'error' || mapRef.current !== state.map) return;
    const { leaflet, map } = state;
    const group = leaflet.featureGroup();
    const markers = new Map<string, Marker>();

    for (const toilet of toilets) {
      const dot = document.createElement('span');
      dot.className = 'block size-3.5 rounded-full border-2 border-white bg-brand-soft-blue shadow-sm';
      const popup = document.createElement('div');
      popup.className = 'grid gap-1 text-xs';
      const heading = document.createElement('strong');
      heading.textContent = toilet.name;
      const kind = document.createElement('span');
      kind.textContent = toilet.kind === 'mosque' ? 'Cami / ibadethane tuvaleti'
        : toilet.kind === 'shopping' ? 'AVM / alışveriş noktası tuvaleti'
          : toilet.kind === 'fuel' ? 'Benzin istasyonu tuvaleti' : 'Tuvalet noktası';
      const address = document.createElement('span');
      address.textContent = [toilet.district, toilet.city].filter(Boolean).join(' / ');
      const directions = document.createElement('a');
      directions.href = `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}&travelmode=walking`;
      directions.target = '_blank';
      directions.rel = 'noopener noreferrer';
      directions.textContent = 'Yol tarifi al';
      directions.className = 'font-medium underline';
      popup.append(heading, kind, address, directions);
      const marker = leaflet.marker([toilet.lat, toilet.lng], {
        title: toilet.name,
        alt: toilet.name,
        icon: leaflet.divIcon({
          html: dot,
          className: 'flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue',
          iconSize: [24, 24],
          popupAnchor: [0, -10],
        }),
        riseOnHover: true,
      }).bindPopup(popup).on('click', () => onSelect(toilet.id)).addTo(group);
      markers.set(toilet.id, marker);
    }
    if (position) {
      leaflet.circleMarker([position.lat, position.lng], { radius: 8, weight: 3, color: '#fff', fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Konumunuz').addTo(group);
    }
    group.addTo(map);
    markersRef.current = markers;
    if (group.getBounds().isValid()) map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 16, animate: false });
    return () => {
      if (markersRef.current === markers) markersRef.current = new Map();
      group.remove();
    };
  }, [state, toilets, position, onSelect]);

  useEffect(() => {
    if (!selectedId || !state || state === 'error' || mapRef.current !== state.map) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    state.map.panTo(marker.getLatLng(), { animate: false });
    marker.openPopup();
  }, [selectedId, state, toilets]);

  return (
    <MapFullscreenFrame className="h-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100" onFullscreenChange={() => mapRef.current?.invalidateSize({ pan: false })}>
      <div ref={containerRef} role="region" aria-label="Kayıtlı tuvalet noktalarının haritası" className="map-fullscreen-canvas h-full" style={{ backgroundColor: '#f4f6f7' }} />
      {(!state || state === 'error') && <p role="status" className="absolute inset-0 z-[500] grid place-items-center bg-gray-100 px-4 text-center text-sm text-gray-600">{state === 'error' ? 'Harita yüklenemedi. Aşağıdaki listeden noktaları ve yol tarifini kullanabilirsiniz.' : 'Harita yükleniyor…'}</p>}
    </MapFullscreenFrame>
  );
}
