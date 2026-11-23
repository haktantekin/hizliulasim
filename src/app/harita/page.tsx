"use client";

import { useState } from "react";
import DirectionsForm from "@/components/maps/DirectionsForm";
import DataSourceNotice from "@/components/ui/DataSourceNotice";
import MapFullscreenFrame from "@/components/maps/MapFullscreenFrame";

export default function HaritaPage() {
  const [mapSrc, setMapSrc] = useState("https://www.google.com/maps?output=embed&q=Istanbul");

  return (
    <>
      <div className="container mx-auto pb-4 px-4 pt-9 space-y-4">
        <DirectionsForm onNavigate={setMapSrc} />
      </div>
      <MapFullscreenFrame className="overflow-hidden">
        <iframe
          title="Harita"
          src={mapSrc}
          className="map-fullscreen-canvas h-[60vh] w-full"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </MapFullscreenFrame>
      <div className="container mx-auto px-4 pb-6">
        <DataSourceNotice
          sources={['googleMaps']}
          note="Harita görünümü ve sürüş yol tarifleri kamu kurumu olmayan Google Maps hizmeti üzerinden sağlanır."
        />
      </div>
    </>
  );
}
