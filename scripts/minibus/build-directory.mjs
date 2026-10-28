import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { findRouteDistricts } from '../../src/lib/minibusDistrictGeometry.ts';
import { slugify } from '../../src/lib/slugify.ts';

const districtNames = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu',
];

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Eksik parametre: ${name}`);
  return process.argv[index + 1];
}

const districtPath = option('--districts');
const routePath = option('--routes');
const outputPath = option('--output');
const minimumInsideKm = Number(option('--minimum-inside-km'));
if (!Number.isFinite(minimumInsideKm) || minimumInsideKm < 0) {
  throw new Error('minimum-inside-km geçersiz.');
}

const [districtGeoJson, routes] = await Promise.all([
  fs.readFile(districtPath, 'utf8').then(JSON.parse),
  fs.readFile(routePath, 'utf8').then(JSON.parse),
]);
if (districtGeoJson.features?.length !== 39) throw new Error('İBB ilçe katmanı 39 kayıt içermiyor.');
if (!Array.isArray(routes) || routes.length < 400) throw new Error('İBB güzergâh listesi beklenenden kısa.');

const namesBySlug = new Map(districtNames.map((name) => [slugify(name), name]));
const boundaries = districtGeoJson.features.map((feature) => {
  const slug = slugify(feature.properties.AD);
  const name = namesBySlug.get(slug);
  if (!name) throw new Error(`Beklenmeyen ilçe: ${feature.properties.AD}`);
  return {
    id: Number(feature.properties.KIMLIKNO),
    name,
    slug,
    geometry: feature.geometry,
    sourceIds: new Set(),
  };
});

const unmatchedSourceIds = [];
for (const route of routes) {
  if (route.error) throw new Error(`${route.sourceId}: ${route.error}`);
  const sourceId = String(route.sourceId).toUpperCase();
  if (!Array.isArray(route.points) || route.points.length < 2) {
    unmatchedSourceIds.push(sourceId);
    continue;
  }
  const matchedDistricts = findRouteDistricts(route.points, boundaries, { minimumInsideKm });
  if (matchedDistricts.length === 0) {
    unmatchedSourceIds.push(sourceId);
    continue;
  }
  for (const district of matchedDistricts) {
    district.sourceIds.add(sourceId);
  }
}

const districts = boundaries
  .map((district) => ({
    id: district.id,
    name: district.name,
    slug: district.slug,
    sourceIds: [...district.sourceIds].sort(),
    lineIds: [],
  }))
  .sort((left, right) => left.name.localeCompare(right.name, 'tr'));
const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: 'ibb-route-geometry-and-sinir-wm',
  minimumInsideKm,
  sourceRecordCount: routes.length,
  unmatchedSourceIds: unmatchedSourceIds.sort(),
  cities: [{ id: 34, name: 'İstanbul', slug: 'istanbul', districts }],
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

const relationCount = districts.reduce((total, district) => total + district.sourceIds.length, 0);
console.log(`RAW_LINES=${routes.length} ROUTES_OK=${routes.length - unmatchedSourceIds.length} ROUTES_UNMATCHED=${unmatchedSourceIds.length} DISTRICTS=${districts.length} RELATIONS=${relationCount} OUTPUT=${path.resolve(outputPath)}`);
