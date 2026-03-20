/**
 * Slugify a Turkish string for URL-friendly paths.
 * Converts Turkish characters, lowercases, replaces spaces/special chars with hyphens.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/İ/g, 'i')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a durak slug from name and code: "sarigazi-ataturk-caddesi-218862"
 */
export function buildDurakSlug(durakAdi: string, durakKodu: string): string {
  return `${slugify(durakAdi)}-${durakKodu}`;
}

/**
 * Extract durak code from slug. The code is the last numeric segment after the final hyphen.
 * e.g. "sarigazi-ataturk-caddesi-218862" → "218862"
 */
export function parseDurakSlug(slug: string): string {
  const match = slug.match(/(\d+)$/);
  return match ? match[1] : slug;
}

/**
 * Extract a human-readable durak name from slug.
 * e.g. "haydarpasa-numune-hastanesi-225571" → "Haydarpasa Numune Hastanesi"
 */
export function parseDurakName(slug: string): string {
  const name = slug.replace(/-\d+$/, '').replace(/-/g, ' ');
  return name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
