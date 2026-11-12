'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { TransitItinerary } from '@/lib/transit/contracts';
import { buildTransitMapModel, type TransitMapMarker } from '@/lib/transit/map-model';
import { getTransitPathStyle, TRANSIT_BASEMAP_OPACITY } from '@/lib/transit/map-style';
import { getModePresentation } from '@/lib/transit/presentation';

export interface TransitRouteMapProps {
  itinerary: TransitItinerary;
  size: 'compact' | 'full';
  selectedAlternative: number;
  selectedStep: number | null;
}

type Leaflet = typeof import('leaflet');

function addKeyPoint(leaflet: Leaflet, group: ReturnType<Leaflet['layerGroup']>, keyPoint: TransitMapMarker) {
  const { points, coordinate, highlighted } = keyPoint;
  const tooltip = document.createElement('div');
  tooltip.className = 'grid max-w-60 gap-1 whitespace-normal';
  const popup = document.createElement('div');
  popup.className = 'relative pr-5 text-sm text-gray-700';
  const list = document.createElement('ul');
  list.className = 'grid max-h-44 list-none gap-2 overflow-y-auto';

  for (const point of points) {
    const modeLabel = point.mode && getModePresentation(point.mode).label;
    const travel = [modeLabel, point.lineCode, point.time].filter(Boolean).join(' · ');
    const tooltipRow = document.createElement('span');
    tooltipRow.textContent = [point.action, point.name, travel].filter(Boolean).join(' · ');
    tooltip.append(tooltipRow);

    const row = document.createElement('li');
    row.className = 'grid gap-0.5';
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
    row.append(heading, name, details);
    list.append(row);
  }

  const firstMode = points[0]?.mode;
  const diameter = highlighted ? 20 : 16;
  const dot = document.createElement('span');
  dot.className = `pointer-events-none block size-full rounded-full border-2 border-white shadow-md ${highlighted ? 'ring-2 ring-brand-soft-blue' : ''}`;
  dot.style.backgroundColor = firstMode ? getModePresentation(firstMode).color : '#304269';
  const marker = leaflet.marker(coordinate, {
    riseOnHover: true,
    zIndexOffset: highlighted ? 1000 : 0,
    icon: leaflet.divIcon({
      className: 'rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue',
      html: dot,
      iconSize: [diameter, diameter],
      tooltipAnchor: [0, -diameter / 2],
      popupAnchor: [0, -diameter / 2],
    }),
  });

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
  popup.append(list, close);

  marker
    .bindTooltip(tooltip, { direction: 'top', opacity: 1 })
    .bindPopup(popup, { closeButton: false })
    .on('popupopen', () => marker.closeTooltip())
    .on('add', () => {
      const icon = marker.getElement();
      icon?.setAttribute('aria-label', points.map(({ action, name }) => `${action} ${name}`).join(' · '));
      icon?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          marker.openPopup();
          (list.querySelector('a') ?? close).focus();
        }
      });
    })
    .addTo(group);
}

export default function TransitRouteMap({ itinerary, size, selectedAlternative, selectedStep }: TransitRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendId = useId();
  const model = useMemo(() => buildTransitMapModel(itinerary, selectedStep), [itinerary, selectedStep]);
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
        opacity: TRANSIT_BASEMAP_OPACITY,
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
    const activeSegment = model.segments.find(({ highlighted }) => highlighted);
    const segments = activeSegment
      ? [...model.segments.filter(({ highlighted }) => !highlighted), activeSegment]
      : model.segments;
    for (const { coordinates, color, dashed, highlighted } of segments) {
      if (coordinates.length < 2) continue;
      const style = getTransitPathStyle({ size, dashed, highlighted, dimmed: Boolean(activeSegment) && !highlighted });
      leaflet.polyline(coordinates, {
        ...style.casing,
        interactive: false,
      }).addTo(group);
      leaflet.polyline(coordinates, {
        color,
        ...style.route,
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
