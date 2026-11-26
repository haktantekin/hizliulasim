'use client';

import dynamic from 'next/dynamic';
import { Box, Map as MapIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { RouteMap3DProps } from './route-map-journey';

const RouteMap2D = dynamic(() => import('./RouteMap2D'), {
  ssr: false,
  loading: () => (
    <div role="status" className="grid h-[300px] place-items-center rounded-xl bg-gray-100 text-sm text-gray-600 md:h-[400px]">
      2B harita hazırlanıyor…
    </div>
  ),
});

const RouteMap3D = dynamic(() => import('./RouteMapGoogle3D'), {
  ssr: false,
  loading: () => (
    <div role="status" className="grid h-[350px] place-items-center rounded-xl bg-slate-900 text-sm text-slate-200 md:h-[500px]">
      3B harita hazırlanıyor…
    </div>
  ),
});

function supportsAcceleratedWebGL2() {
  try {
    const context = document.createElement('canvas').getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
    });
    if (!context) return false;

    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function RouteMap(props: RouteMap3DProps) {
  const [view, setView] = useState<'2B' | '3B'>('2B');
  const [notice, setNotice] = useState<string | null>(null);
  const views = [
    { label: '2B', Icon: MapIcon },
    { label: '3B', Icon: Box },
  ] as const;

  const show2DInstead = useCallback((message: string) => {
    setNotice(message);
    setView('2B');
  }, []);

  function selectView(nextView: '2B' | '3B') {
    if (nextView === '3B') {
      if (view === '3B') return;
      if (!supportsAcceleratedWebGL2()) {
        show2DInstead('Bu tarayıcı 3B haritayı çalıştıramıyor.');
        return;
      }
    }
    setNotice(null);
    setView(nextView);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div role="group" aria-label="Harita görünümü" className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {views.map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-pressed={view === label}
              onClick={() => selectView(label)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue ${
                view === label ? 'bg-brand-soft-blue text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {notice && (
        <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-slate-700">
          {notice} Güzergâh ve duraklar 2B haritada gösteriliyor.
        </p>
      )}
      {view === '3B' ? <RouteMap3D {...props} onUnavailable={show2DInstead} /> : <RouteMap2D {...props} />}
    </div>
  );
}
