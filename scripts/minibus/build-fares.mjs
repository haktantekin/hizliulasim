import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { parseMinibusFareTariffHtml } from '../../src/lib/minibusFare.ts';

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Eksik parametre: ${name}`);
  return process.argv[index + 1];
}

const inputPath = option('--input');
const outputPath = option('--output');
const sourceUrl = option('--source-url');
const records = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (!Array.isArray(records) || records.length < 100) throw new Error('Tarife yanıt listesi beklenenden kısa.');

const tariffs = records.map((record) => {
  if (record.error) throw new Error(`${record.code}: ${record.error}`);
  return parseMinibusFareTariffHtml(record.html, record.code);
});
const snapshot = {
  version: 1,
  generatedAt: new Date().toISOString(),
  sourceUrl,
  tariffs,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

const entryCount = tariffs.reduce((total, tariff) => total + tariff.entries.length, 0);
console.log(`TARIFFS=${tariffs.length} ENTRIES=${entryCount} OUTPUT=${path.resolve(outputPath)}`);
