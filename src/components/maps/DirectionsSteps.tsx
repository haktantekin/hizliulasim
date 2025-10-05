"use client";

import { useEffect, useState } from 'react';

type Step = { instruction: string; distance: string; duration: string; maneuver?: string };

export default function DirectionsSteps({ origin, destination, mode, open }: { origin: string; destination: string; mode: 'driving' | 'walking' | 'bicycling' | 'transit'; open: boolean }) {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [meta, setMeta] = useState<{ distance?: string; duration?: string; status?: string; error_message?: string } | null>(null);

  useEffect(() => {
    const fetchSteps = async () => {
      if (!open) { setSteps([]); setMeta(null); return; }
      if (!destination) { setSteps([]); setMeta(null); return; }
      if (!origin) { setSteps([]); setMeta({ status: 'MISSING_ORIGIN' }); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          origin: origin || '',
          destination,
          mode,
        });
        const res = await fetch(`/api/maps/directions?${params.toString()}`);
        const data = await res.json();
        setSteps(data.steps || []);
        setMeta({ distance: data.distance, duration: data.duration, status: data.status, error_message: data.error_message });
      } catch {
        setSteps([]);
        setMeta(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSteps();
  }, [origin, destination, mode, open]);

  if (!open || !destination) return null;

  return (
    <div className="rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between text-sm text-gray-700">
        <div>Adım adım yol tarifi</div>
        {meta && (
          <div className="flex gap-3">
            {meta.distance && <span>Mesafe: {meta.distance}</span>}
            {meta.duration && <span>Süre: {meta.duration}</span>}
          </div>
        )}
      </div>
      <ol className="divide-y divide-gray-100">
        {loading && (
          <li className="px-4 py-3 text-sm text-gray-500">Yükleniyor…</li>
        )}
        {!loading && steps.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-500">
            {meta?.status === 'MISSING_ORIGIN' && 'Lütfen başlangıç noktasını girin.'}
            {meta?.status && meta?.status !== 'MISSING_ORIGIN' && meta?.status !== 'OK' && (
              <>Rota bulunamadı{meta?.error_message ? `: ${meta.error_message}` : '.'}</>
            )}
            {!meta?.status && 'Rota bulunamadı.'}
          </li>
        )}
        {!loading && steps.map((s, i) => (
          <li key={i} className="px-4 py-3 text-sm">
            <div className="font-medium text-gray-900">{i + 1}. {s.instruction}</div>
            <div className="text-gray-500 text-xs mt-0.5">{s.distance}{s.duration ? ` • ${s.duration}` : ''}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
