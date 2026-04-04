'use client';

import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';

interface TrafficData {
  index: number;
  date: string;
  history: { index: number; date: string }[];
}

function getColor(index: number) {
  if (index <= 30) return { bg: 'bg-green-500', text: 'text-green-600', label: 'Rahat' };
  if (index <= 50) return { bg: 'bg-yellow-400', text: 'text-yellow-600', label: 'Normal' };
  if (index <= 70) return { bg: 'bg-orange-500', text: 'text-orange-600', label: 'Yoğun' };
  return { bg: 'bg-red-500', text: 'text-red-600', label: 'Çok Yoğun' };
}

export default function TrafficIndex() {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchTraffic() {
      try {
        setLoading(true);
        setError(false);
        const res = await fetch('/api/traffic');
        if (!res.ok) throw new Error('API error');
        const json: TrafficData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTraffic();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 flex items-center justify-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Trafik bilgisi yükleniyor...
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  const color = getColor(data.index);

  // Get last 12 hours of history for mini chart
  const chartData = data.history.slice(-12);
  const maxIndex = Math.max(...chartData.map(h => h.index), 1);

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">İstanbul Trafik Yoğunluğu</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color.bg} text-white`}>
          {color.label}
        </span>
      </div>

      <div className="flex items-end gap-4">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          <div className={`text-3xl font-bold ${color.text}`}>
            {data.index}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">/100</div>
        </div>

        {/* Progress bar */}
        <div className="flex-1">
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${color.bg}`}
              style={{ width: `${Math.min(data.index, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mini bar chart - last 12 hours */}
      {chartData.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <div className="text-[10px] text-gray-400 mb-1.5">Son 12 saat</div>
          <div className="flex items-end gap-0.5 h-8">
            {chartData.map((h, i) => {
              const barColor = getColor(h.index);
              const height = Math.max((h.index / maxIndex) * 100, 8);
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${barColor.bg} opacity-70 transition-all`}
                  style={{ height: `${height}%` }}
                  title={`${h.index} - ${h.date}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
