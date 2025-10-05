"use client";

type Mode = "driving" | "walking" | "bicycling" | "transit";

import { Bike, Car, Footprints, Train, ChevronDown, ChevronUp } from "lucide-react";
import type { ReactElement } from "react";

export default function TravelModeSelector({ mode, onChange, detailsOpen, onToggleDetails }: { mode: Mode; onChange: (m: Mode) => void; detailsOpen?: boolean; onToggleDetails?: () => void }) {
  const modes: { key: Mode; icon: ReactElement; label: string }[] = [
    { key: "driving", icon: <Car className="w-4 h-4" />, label: "Araba" },
    { key: "walking", icon: <Footprints className="w-4 h-4" />, label: "Yürüyüş" },
    { key: "bicycling", icon: <Bike className="w-4 h-4" />, label: "Bisiklet" },
    { key: "transit", icon: <Train className="w-4 h-4" />, label: "Toplu Taşıma" },
  ];
  return (
    <div className="flex items-center gap-2">
      {modes.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          aria-label={label}
          className={`p-2 rounded-full border ${
            key === mode
              ? 'bg-dark-blue text-white border-dark-blue'
              : 'bg-white text-dark-blue border-gray-200 hover:bg-gray-100'
          }`}
        >
          {icon}
          <span className="sr-only">{label}</span>
        </button>
      ))}
      {onToggleDetails && (
        <button
          onClick={onToggleDetails}
          title={detailsOpen ? 'Detayları Gizle' : 'Detayları Göster'}
          aria-label={detailsOpen ? 'Detayları Gizle' : 'Detayları Göster'}
          className={`p-2 rounded-full border bg-white text-dark-blue border-gray-200 hover:bg-gray-100`}
        >
          {detailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
