import { slugify } from '../slugify.ts';

export interface LocationOption {
  key: string;
  label: string;
}

const canonicalLabels = new Map([
  ['istanbul', 'İstanbul'],
  ['izmir', 'İzmir'],
]);
const collator = new Intl.Collator('tr');

export function locationKey(value: string | null): string {
  return value ? slugify(value.trim()) : '';
}

function locationLabel(value: string, key: string): string {
  const canonical = canonicalLabels.get(key);
  if (canonical) return canonical;
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('tr-TR')
    .replace(/(^|[\s-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase('tr-TR'));
}

/** Group spelling/case variants without guessing a settlement's province. */
export function buildLocationOptions(values: readonly (string | null)[]): LocationOption[] {
  const labels = new Map<string, string>();
  for (const value of values) {
    const key = locationKey(value);
    if (!value || !key) continue;
    const label = locationLabel(value, key);
    const previous = labels.get(key);
    // Prefer an existing Turkish spelling when both accented and ASCII names occur.
    const accents = (text: string) => (text.match(/[çğıöşüÇĞİÖŞÜ]/gu) ?? []).length;
    if (!previous || accents(label) > accents(previous)) labels.set(key, label);
  }
  return Array.from(labels, ([key, label]) => ({ key, label })).sort((a, b) => collator.compare(a.label, b.label));
}
