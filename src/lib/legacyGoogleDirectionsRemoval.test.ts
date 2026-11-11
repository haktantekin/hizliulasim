import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const srcDirectory = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.[cm]?[jt]sx?$/.test(entry.name) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];

    return [path];
  });
}

test('keeps /harita iframe navigation without the removed Google Directions details integration', () => {
  const haritaPagePath = fileURLToPath(new URL('../app/harita/page.tsx', import.meta.url));
  const haritaPageSource = readFileSync(haritaPagePath, 'utf8');
  const directionsFormSource = readFileSync(
    fileURLToPath(new URL('../components/maps/DirectionsForm.tsx', import.meta.url)),
    'utf8',
  );

  assert.match(haritaPageSource, /<DirectionsForm\b/);
  assert.match(haritaPageSource, /<iframe\b/);
  assert.match(haritaPageSource, /https:\/\/www\.google\.com\/maps\?output=embed/);
  assert.match(directionsFormSource, /https:\/\/www\.google\.com\/maps\?output=embed/);
  assert.match(directionsFormSource, /onNavigate\(embedUrl\)/);

  assert.equal(
    existsSync(fileURLToPath(new URL('../components/maps/DirectionsSteps.tsx', import.meta.url))),
    false,
  );
  assert.equal(
    existsSync(fileURLToPath(new URL('../app/api/maps/directions/route.ts', import.meta.url))),
    false,
  );

  const forbiddenReferences = sourceFiles(srcDirectory).flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    const references: string[] = [];

    if (source.includes('/api/maps/directions')) references.push(`${path}: Google Directions API caller`);
    if (source.includes('DirectionsSteps')) references.push(`${path}: DirectionsSteps consumer`);

    return references;
  });

  assert.deepEqual(forbiddenReferences, [], `legacy references remain:\n${forbiddenReferences.join('\n')}`);
});
