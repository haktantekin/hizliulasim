"use client";

import { useQuery } from '@tanstack/react-query';

type Step = { instruction: string; distance: string; duration: string; maneuver?: string };

export default function DirectionsSteps({ origin, destination, mode, open }: { origin: string; destination: string; mode: 'driving' | 'walking' | 'bicycling' | 'transit'; open: boolean }) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ['directions', origin, destination, mode],
    queryFn: async () => {
      const params = new URLSearchParams({
        origin: origin || '',
        destination,
        mode,
      });
      const res = await fetch(`/api/maps/directions?${params.toString()}`);
      return res.json();
    },
    enabled: open && !!destination && !!origin,
  });

  const steps: Step[] = data?.steps || [];
  const meta = !open || !destination
    ? null
    : !origin
    ? { status: 'MISSING_ORIGIN' as const }
    : data
    ? { distance: data.distance, duration: data.duration, status: data.status, error_message: data.error_message }
    : null;

  if (!open || !destination) return null;

  return (
    <div className="rounded-xl border border-brand-light-blue">
      <div className="px-4 py-3 border-b border-brand-light-blue flex items-center justify-between text-sm text-gray-700">
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
          <li key={`${s.instruction}-${s.distance}`} className="px-4 py-3 text-sm">
            <div className="font-medium text-gray-900">{i + 1}. {s.instruction}</div>
            <div className="text-gray-500 text-xs mt-0.5">{s.distance}{s.duration ? ` • ${s.duration}` : ''}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
