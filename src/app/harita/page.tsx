"use client";

import { useReducer } from "react";
import DirectionsForm from "@/components/maps/DirectionsForm";
import DirectionsSteps from "@/components/maps/DirectionsSteps";

interface HaritaState {
  mapSrc: string;
  origin: string;
  destination: string;
  mode: "driving" | "walking" | "bicycling" | "transit";
  showDetails: boolean;
  searched: boolean;
}

type HaritaAction =
  | { type: "SET_MAP_SRC"; payload: string }
  | { type: "SET_NAVIGATION"; payload: { origin: string; destination: string; mode: "driving" | "walking" | "bicycling" | "transit" } }
  | { type: "TOGGLE_DETAILS" }
  | { type: "SET_SEARCHED" };

const initialState: HaritaState = {
  mapSrc: "https://www.google.com/maps?output=embed&q=Istanbul",
  origin: "",
  destination: "",
  mode: "driving",
  showDetails: false,
  searched: false,
};

function haritaReducer(state: HaritaState, action: HaritaAction): HaritaState {
  switch (action.type) {
    case "SET_MAP_SRC":
      return { ...state, mapSrc: action.payload };
    case "SET_NAVIGATION":
      return { ...state, ...action.payload };
    case "TOGGLE_DETAILS":
      return { ...state, showDetails: !state.showDetails };
    case "SET_SEARCHED":
      return { ...state, searched: true };
    default:
      return state;
  }
}

export default function HaritaPage() {
  const [state, dispatch] = useReducer(haritaReducer, initialState);

  return (
    <>
      <div className="container mx-auto pb-4 px-4 pt-9 space-y-4">
        <DirectionsForm
          onNavigate={(url) => dispatch({ type: "SET_MAP_SRC", payload: url })}
          onChange={({ origin, destination, mode }) => {
            dispatch({ type: "SET_NAVIGATION", payload: { origin, destination, mode } });
          }}
          onSubmit={() => dispatch({ type: "SET_SEARCHED" })}
          showDetailsControl={state.searched}
          detailsOpen={state.showDetails}
          onToggleDetails={() => dispatch({ type: "TOGGLE_DETAILS" })}
        />
        <DirectionsSteps origin={state.origin} destination={state.destination} mode={state.mode} open={state.showDetails} />
      </div>
      <div className="overflow-hidden">
        <iframe
          title="Harita"
          src={state.mapSrc}
          className="w-full h-[60vh]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </>
  );
}
