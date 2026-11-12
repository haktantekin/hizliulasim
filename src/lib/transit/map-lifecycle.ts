type DrawableLeafletMap = {
  getPane(name: string): unknown;
};

/** Rejects map instances whose panes were removed during React Fast Refresh cleanup. */
export function canDrawTransitMap(
  currentMap: DrawableLeafletMap | null,
  candidateMap: DrawableLeafletMap,
): boolean {
  return currentMap === candidateMap && candidateMap.getPane('overlayPane') !== undefined;
}
