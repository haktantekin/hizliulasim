"use client";

import { useState } from "react";
import DirectionsForm from "@/components/maps/DirectionsForm";

export default function HaritaPage() {
  const [mapSrc, setMapSrc] = useState("https://www.google.com/maps?output=embed&q=Istanbul");

  return (
    <>
      <div className="container mx-auto pb-4 px-4 pt-9 space-y-4">
        <DirectionsForm onNavigate={setMapSrc} />
      </div>
      <div className="overflow-hidden">
        <iframe
          title="Harita"
          src={mapSrc}
          className="w-full h-[60vh]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </>
  );
}
