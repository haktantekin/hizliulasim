"use client";

import React from "react";
import { ChevronRight, ExternalLink, MapPin, Star } from "lucide-react";

interface Props {
  name?: string;
  address?: string;
  rating?: number;
  city: string;
  district?: string;
  onDirections: () => void;
  onOpenMaps: () => void;
  className?: string;
  variant?: 'plain' | 'elevated';
  ratingPlacement?: 'header' | 'below';
}

export default function PlaceCarouselCard({ name, address, rating, city, district, onDirections, onOpenMaps, className = "", variant = 'elevated', ratingPlacement = 'header' }: Props) {
  const containerBase = "min-w-[260px] bg-white";
  const containerVariant = variant === 'plain' ? "rounded " : "border rounded-xl shadow-sm ";
  return (
    <div className={`${containerBase}${containerVariant}${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-800 line-clamp-1">{name}</div>
          <div className="text-xs text-gray-500 line-clamp-1">{address}</div>
        </div>
        {ratingPlacement === 'header' && (
          <div className="flex items-center gap-1 text-amber-500">
            <Star size={14} />
            <span className="text-sm font-medium">{typeof rating === 'number' ? rating.toFixed(1) : '-'}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <MapPin size={14} /> {district ? `${district}, ${city}` : city}
        </div>
        {ratingPlacement === 'below' && (
          <div className="flex items-center gap-1 text-amber-500 pl-3">
            <Star size={14} />
            <span className="text-xs font-medium">{typeof rating === 'number' ? rating.toFixed(1) : '-'}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={onDirections} className="px-3 py-1.5 text-xs bg-brand-dark-blue text-white rounded-full hover:opacity-90 flex items-center gap-1">
          Yol Tarifi <ChevronRight size={14} />
        </button>
        <button onClick={onOpenMaps} className="px-3 py-1.5 text-xs bg-gray-100 text-brand-dark-blue rounded-full hover:bg-gray-200 flex items-center gap-1">
          Haritada Aç <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
