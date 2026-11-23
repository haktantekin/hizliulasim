'use client';

import { useEffect, useRef, useState } from 'react';
import MapFullscreenFrame from '@/components/maps/MapFullscreenFrame';
import { compactLeafletAttribution, OPENSTREETMAP_ATTRIBUTION, OPENSTREETMAP_TILE_URL } from '@/lib/maps/leafletAttribution';

interface PostLocationMapProps {
  latitude: number;
  longitude: number;
  title?: string;
}

export default function PostLocationMap({ latitude, longitude, title }: PostLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    // Guard: clean up stale Leaflet state from Strict Mode re-mount
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
      container.innerHTML = '';
    }

    let cancelled = false;

    // Dynamically import Leaflet only on client side
    import('leaflet').then((L) => {
      if (cancelled || mapRef.current) return;
      if ((container as any)._leaflet_id) return;

      // Dynamically load CSS
      if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Fix for default marker icon in Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Initialize map
      const map = L.map(container, {
        scrollWheelZoom: false,
        center: [latitude, longitude],
        zoom: 17,
      });
      compactLeafletAttribution(map);

      // Add OpenStreetMap tile layer
      L.tileLayer(OPENSTREETMAP_TILE_URL, {
        maxZoom: 19,
        attribution: OPENSTREETMAP_ATTRIBUTION,
      }).addTo(map);

      // Add marker
      const marker = L.marker([latitude, longitude]).addTo(map);
      
      if (title) {
        marker.bindPopup(title);
      }

      mapRef.current = map;
      setIsLoaded(true);
    });

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setIsLoaded(false);
    };
  }, [latitude, longitude, title]);

  return (
    <div className="mb-6">
      <MapFullscreenFrame onFullscreenChange={() => mapRef.current?.invalidateSize()}>
        <div
          ref={mapContainerRef}
          className="map-fullscreen-canvas h-[300px] w-full overflow-hidden rounded-lg border border-gray-200 shadow-md md:h-[400px]"
          style={{ background: isLoaded ? 'transparent' : '#f0f0f0' }}
        />
      </MapFullscreenFrame>
    </div>
  );
}
