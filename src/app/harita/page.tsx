"use client";

import { useState } from "react";
import DirectionsForm from "@/components/maps/DirectionsForm";
import DirectionsSteps from "@/components/maps/DirectionsSteps";

export default function HaritaPage() {
  const [mapSrc, setMapSrc] = useState<string>("https://www.google.com/maps?output=embed&q=Istanbul");
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [mode, setMode] = useState<"driving" | "walking" | "bicycling" | "transit">("driving");
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);

  return (
    <>
      <div className="container mx-auto pb-4 px-4 pt-9 space-y-4">
        <DirectionsForm
          onNavigate={(url) => setMapSrc(url)}
          onChange={({ origin, destination, mode }) => {
            setOrigin(origin);
            setDestination(destination);
            setMode(mode);
          }}
          onSubmit={() => setSearched(true)}
          showDetailsControl={searched}
          detailsOpen={showDetails}
          onToggleDetails={() => setShowDetails((v) => !v)}
        />
        {/* Legacy text link removed: details toggle icon now lives next to mode icons */}
        <DirectionsSteps origin={origin} destination={destination} mode={mode} open={showDetails} />
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
