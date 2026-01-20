'use client';

import { useEffect, useRef, useState } from 'react';

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
    if (!mapContainerRef.current || mapRef.current) return;

    // Dynamically import Leaflet only on client side
    import('leaflet').then((L) => {
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
      const map = L.map(mapContainerRef.current!, {
        scrollWheelZoom: false,
        center: [latitude, longitude],
        zoom: 21, // Higher zoom for building details
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları',
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, title]);

  return (
    <div className="mb-6">
      <div 
        ref={mapContainerRef}
        className="w-full h-[300px] md:h-[400px] border border-gray-200 rounded-lg overflow-hidden shadow-md"
        style={{ background: isLoaded ? 'transparent' : '#f0f0f0' }}
      />
    </div>
  );
}
