"use client";

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

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
  const [open, setOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState('');
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setDebouncedValue('');
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setDebouncedValue(value);
    }, 200);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value]);

  const { data: suggestions = [] } = useQuery<Prediction[]>({
    queryKey: ['autocomplete', debouncedValue],
    queryFn: async () => {
      const res = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(debouncedValue)}`);
      const data = await res.json();
      return data.predictions || [];
    },
    enabled: !!debouncedValue,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (suggestions.length > 0 && debouncedValue) {
      setOpen(true);
    }
  }, [suggestions, debouncedValue]);

  return (
    <div className="relative">
      <input
        className="w-full border border-brand-light-blue rounded-lg px-3 py-2"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-brand-light-blue rounded-lg shadow">
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
