'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { TransitItinerary } from '@/lib/transit/contracts';
import { buildTransitMapModel, type TransitMapMarker } from '@/lib/transit/map-model';
import { getModePresentation } from '@/lib/transit/presentation';

export interface TransitRouteMapProps {
  itinerary: TransitItinerary;
  size: 'compact' | 'full';
  selectedAlternative: number;
}

type Leaflet = typeof import('leaflet');

function addKeyPoint(leaflet: Leaflet, group: ReturnType<Leaflet['layerGroup']>, point: TransitMapMarker) {
  const mode = point.mode ? getModePresentation(point.mode) : undefined;
  const travel = [mode?.label, point.lineCode, point.time].filter(Boolean).join(' · ');
  const label = [point.action, point.name, travel].filter(Boolean).join(' · ');
  const tooltip = document.createElement('span');
  tooltip.textContent = label;

  const dot = document.createElement('span');
  dot.className = 'pointer-events-none block size-full rounded-full border-2 border-white shadow-md';
  dot.style.backgroundColor = mode?.color ?? '#304269';
  const marker = leaflet.marker(point.coordinate, {
    riseOnHover: true,
    icon: leaflet.divIcon({
      className: 'rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue',
      html: dot,
      iconSize: [20, 20],
      tooltipAnchor: [0, -10],
      popupAnchor: [0, -10],
    }),
  });

  const popup = document.createElement('div');
  popup.className = 'relative grid gap-1 pr-5 text-sm text-gray-700';
  const heading = document.createElement('strong');
  heading.textContent = point.action;
  const name = document.createElement(point.href ? 'a' : 'span');
  name.className = 'font-semibold';
  name.textContent = point.name;
  if (name instanceof HTMLAnchorElement && point.href) {
    name.href = point.href;
    name.classList.add('underline', 'underline-offset-2');
  }
  const details = document.createElement('span');
  details.textContent = [point.code, travel].filter(Boolean).join(' · ');
  details.className = 'text-xs';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Durak bilgisini kapat');
  close.className = 'absolute right-0 top-0 cursor-pointer px-1 text-lg leading-none';
  function closePopup() {
    marker.closePopup();
    marker.getElement()?.focus();
  }
  close.addEventListener('click', closePopup);
  popup.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePopup();
    }
  });
  popup.append(heading, name, details, close);

  marker
    .bindTooltip(tooltip, { direction: 'top', opacity: 1 })
    .bindPopup(popup, { closeButton: false })
    .on('popupopen', () => marker.closeTooltip())
    .on('add', () => {
      const icon = marker.getElement();
      icon?.setAttribute('aria-label', label);
      icon?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          marker.openPopup();
          (point.href ? name : close).focus();
        }
      });
    })
    .addTo(group);
}

export default function TransitRouteMap({ itinerary, size, selectedAlternative }: TransitRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendId = useId();
  const model = useMemo(() => buildTransitMapModel(itinerary), [itinerary]);
  const hasBounds = model.bounds !== null;
  const [mapState, setMapState] = useState<{ leaflet: Leaflet; map: LeafletMap } | 'unavailable' | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let map: LeafletMap | undefined;

    // Both imports are cached and run only once an itinerary map is mounted.
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([leaflet]) => {
      if (cancelled) return;
      map = leaflet.map(container, { scrollWheelZoom: false });
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      setMapState({ leaflet, map });
    }).catch(() => {
      if (!cancelled) setMapState('unavailable');
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapState || mapState === 'unavailable' || !model.bounds) return;
    const { leaflet, map } = mapState;
    const group = leaflet.layerGroup();
    for (const { coordinates, color, dashed } of model.segments) {
      if (coordinates.length < 2) continue;
      leaflet.polyline(coordinates, {
        color,
        weight: size === 'compact' ? 4 : 5,
        dashArray: dashed ? '6 7' : undefined,
        interactive: false,
      }).addTo(group);
    }
    for (const point of model.markers) addKeyPoint(leaflet, group, point);
    group.addTo(map);
    map.fitBounds(model.bounds, { padding: [26, 26], maxZoom: 16, animate: false });
    return () => { group.remove(); };
  }, [mapState, model, size]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative isolate min-h-0 grow overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
        <div
          ref={containerRef}
          role="region"
          aria-label={`${selectedAlternative + 1}. rota haritası`}
          aria-describedby={model.hasApproximateGeometry ? legendId : undefined}
          className={hasBounds && mapState !== 'unavailable' ? 'h-full' : 'invisible h-full'}
        />
        {(!hasBounds || !mapState || mapState === 'unavailable') && (
          <p role="status" className="absolute inset-0 grid place-items-center text-sm text-gray-600">
            {!hasBounds || mapState === 'unavailable' ? 'Harita yüklenemedi.' : 'Harita yükleniyor…'}
          </p>
        )}
      </div>
      {model.hasApproximateGeometry && (
        <p id={legendId} className="flex items-center gap-2 text-xs text-gray-700">
          <span aria-hidden="true" className="w-6 border-t-2 border-dashed border-gray-600" />
          Kesik çizgi: Yaklaşık güzergâh
        </p>
      )}
    </div>
  );
}
