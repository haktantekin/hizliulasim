import type { Map as LeafletMap } from 'leaflet';

export const OPENSTREETMAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap</a>';

export const OPENSTREETMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function compactLeafletAttribution(map: LeafletMap) {
  map.attributionControl.setPrefix(false);
}
