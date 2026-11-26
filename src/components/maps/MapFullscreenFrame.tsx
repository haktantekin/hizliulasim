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
  const previousFullscreen = useRef(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);
  const viewportFullscreen = placeholderHeight !== null;
  const isFullscreen = browserFullscreen || viewportFullscreen;

  useEffect(() => {
    callbackRef.current = onFullscreenChange;
  }, [onFullscreenChange]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const frame = frameRef.current;
      const active = frame !== null && document.fullscreenElement === frame;
      setBrowserFullscreen(active);
      if (active) setPlaceholderHeight(null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (previousFullscreen.current === isFullscreen) return;
    previousFullscreen.current = isFullscreen;

    let resizeFrame = 0;
    const layoutFrame = requestAnimationFrame(() => {
      resizeFrame = requestAnimationFrame(() => callbackRef.current?.(isFullscreen));
    });
    return () => {
      cancelAnimationFrame(layoutFrame);
      cancelAnimationFrame(resizeFrame);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!viewportFullscreen) return;

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setPlaceholderHeight(null);
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [viewportFullscreen]);

  async function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) return;

    if (viewportFullscreen) {
      setPlaceholderHeight(null);
      return;
    }

    if (document.fullscreenElement === frame) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    if (document.fullscreenEnabled && typeof frame.requestFullscreen === 'function') {
      try {
        await frame.requestFullscreen();
        if (document.fullscreenElement === frame) return;
      } catch {
        // A WebView or browser can reject a native fullscreen request.
      }
    }

    if (frame.isConnected && document.fullscreenElement !== frame) {
      setPlaceholderHeight(frame.getBoundingClientRect().height);
    }
  }

  return (
    <>
      {viewportFullscreen && <div aria-hidden style={{ height: placeholderHeight }} />}
      <div
        ref={frameRef}
        data-viewport-fullscreen={viewportFullscreen || undefined}
        className={`map-fullscreen-frame relative isolate ${className}`}
      >
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
    </>
  );
}
