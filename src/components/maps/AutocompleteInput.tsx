"use client";

import { useEffect, useRef, useState } from 'react';

type Prediction = { description: string };

export default function AutocompleteInput({
  placeholder,
  value,
  onChange,
  onSelect,
}: {
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (v: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setSuggestions([]);
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSuggestions(data.predictions || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 200);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <input
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow">
          {suggestions.map((s: Prediction) => (
            <button
              key={s.description}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(s.description);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              {s.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
