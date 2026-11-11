"use client";

type Mode = "driving" | "walking" | "bicycling" | "transit";

import { Bike, Car, Footprints, Train } from "lucide-react";
import type { ReactElement } from "react";

export default function TravelModeSelector({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
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
              ? 'bg-brand-orange text-white'
              : 'bg-white text-brand-dark-blue border-brand-light-blue hover:bg-gray-100'
          }`}
        >
          {icon}
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
