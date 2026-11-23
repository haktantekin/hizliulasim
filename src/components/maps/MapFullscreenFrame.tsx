'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface MapFullscreenFrameProps {
  children: ReactNode;
  className?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export default function MapFullscreenFrame({
  children,
  className = '',
  onFullscreenChange,
}: MapFullscreenFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onFullscreenChange);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    callbackRef.current = onFullscreenChange;
  }, [onFullscreenChange]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === frameRef.current;
      setIsFullscreen(active);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => callbackRef.current?.(active));
      });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === frameRef.current) {
        await document.exitFullscreen();
      } else {
        await frameRef.current?.requestFullscreen();
      }
    } catch {
      // Browsers can reject fullscreen when the user gesture is interrupted.
    }
  }

  return (
    <div ref={frameRef} className={`map-fullscreen-frame relative isolate ${className}`}>
      {children}
      <button
        type="button"
        onClick={() => { void toggleFullscreen(); }}
        aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Haritayı tam ekran göster'}
        title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
        className="absolute right-3 top-3 z-[1000] inline-flex size-10 items-center justify-center rounded-lg border border-gray-300 bg-white/95 text-gray-700 shadow-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue"
      >
        {isFullscreen ? <Minimize2 aria-hidden className="size-5" /> : <Maximize2 aria-hidden className="size-5" />}
      </button>
    </div>
  );
}
