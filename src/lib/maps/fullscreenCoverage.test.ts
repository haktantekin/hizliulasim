import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import test from 'node:test';

const sourceRoot = join(process.cwd(), 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

test('every embedded map uses the shared fullscreen frame', () => {
  const uncovered = sourceFiles(sourceRoot)
    .filter((path) => {
      const source = readFileSync(path, 'utf8');
      return /(?:\bL|\bleaflet)\.map\(|<iframe\b/.test(source) && !source.includes('MapFullscreenFrame');
    })
    .map((path) => relative(process.cwd(), path));

  assert.deepEqual(uncovered, []);
});

test('every Leaflet map removes the library prefix and keeps OSM tile attribution', () => {
  const files = sourceFiles(sourceRoot);
  const mapsWithoutCompactCredit = files
    .filter((path) => /(?:\bL|\bleaflet)\.map\(/.test(readFileSync(path, 'utf8')))
    .filter((path) => !readFileSync(path, 'utf8').includes('compactLeafletAttribution'))
    .map((path) => relative(process.cwd(), path));
  const tilesWithoutOsmCredit = files
    .filter((path) => readFileSync(path, 'utf8').includes('tileLayer('))
    .filter((path) => !readFileSync(path, 'utf8').includes('OPENSTREETMAP_ATTRIBUTION'))
    .map((path) => relative(process.cwd(), path));

  assert.deepEqual(mapsWithoutCompactCredit, []);
  assert.deepEqual(tilesWithoutOsmCredit, []);
});
