"use client";

import { useEffect, useState } from 'react';
import AutocompleteInput from './AutocompleteInput';
import TravelModeSelector from './TravelModeSelector';
import { ArrowRight } from 'lucide-react';

type Mode = "driving" | "walking" | "bicycling" | "transit";

export default function DirectionsForm({ onNavigate, onChange, onSubmit, showDetailsControl, detailsOpen, onToggleDetails }: { onNavigate?: (url: string) => void; onChange?: (s: { origin: string; destination: string; mode: Mode }) => void; onSubmit?: () => void; showDetailsControl?: boolean; detailsOpen?: boolean; onToggleDetails?: () => void }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<Mode>('driving');

  const openDirections = () => {
    if (!destination) return;
    // Build standard URL (fallback behavior)
    const originParam = origin || 'My Location';
    const standardUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;

    // Build embed URL to show within an iframe without exposing an API key
    let embedUrl: string;
    if (origin) {
      const dirflgMap: Record<Mode, string> = { driving: 'd', walking: 'w', bicycling: 'b', transit: 'r' };
      const dirflg = dirflgMap[mode] || 'd';
      embedUrl = `https://www.google.com/maps?output=embed&dirflg=${dirflg}&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}`;
    } else {
      // If no origin, embed destination map/search view
      embedUrl = `https://www.google.com/maps?output=embed&q=${encodeURIComponent(destination)}`;
    }

    if (onNavigate) {
      onNavigate(embedUrl);
    } else {
      window.open(standardUrl, '_blank', 'noopener,noreferrer');
    }
    onSubmit?.();
  };

  useEffect(() => {
    onChange?.({ origin, destination, mode });
  }, [origin, destination, mode, onChange]);

  return (
    <div className="space-y-3">
      <AutocompleteInput placeholder="Nereden? (opsiyonel)" value={origin} onChange={setOrigin} onSelect={setOrigin} />
      <AutocompleteInput placeholder="Nereye gitmek istiyorsun?" value={destination} onChange={setDestination} onSelect={setDestination} />
      {!origin && destination && (
        <div className="text-xs text-gray-500">Adım adım tarif için başlangıç noktası gereklidir.</div>
      )}
      <div className="flex items-center justify-between gap-3">
        <TravelModeSelector mode={mode} onChange={setMode} {...(showDetailsControl ? { detailsOpen, onToggleDetails } : {})} />
        <button
          onClick={openDirections}
          title="Rota Oluştur"
          aria-label="Rota Oluştur"
          className="p-2 rounded-lg bg-brand-dark-blue text-white hover:opacity-90"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
