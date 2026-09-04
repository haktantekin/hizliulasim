export type SitemapCategory = {
  id: number;
  slug: string;
  parent: number;
  count: number;
};

export type SitemapCmsItem = {
  url: string;
  modified?: string;
  type?: 'post' | 'page';
};

export type SitemapEntry = {
  url: string;
  lastModified?: string;
};

export type SitemapGroup = {
  name: string;
  entries: SitemapEntry[];
  lastModified?: string;
};

export type SitemapFallbackPost = {
  slug: string;
  modified: string;
  categories: number[];
};

const LEGACY_ROOTS = new Set(['blog', 'nasil-giderim']);

function normalizeBaseUrl(baseUrl: string): URL {
  const parsed = new URL(baseUrl);
  parsed.protocol = 'https:';
  parsed.hostname = parsed.hostname.replace(/^www\./i, '');
  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed;
}

function normalizeCanonicalUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const base = normalizeBaseUrl(baseUrl);
    const parsed = new URL(rawUrl, base);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (parsed.hostname.replace(/^www\./i, '').toLowerCase() !== base.hostname.toLowerCase()) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments[0] && LEGACY_ROOTS.has(segments[0].toLocaleLowerCase('tr-TR'))) return null;

    const pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
    return pathname === '/' ? base.origin : `${base.origin}${pathname}`;
  } catch {
    return null;
  }
}

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function latestDate(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function firstPathSegment(url: string): string {
  return new URL(url).pathname.split('/').filter(Boolean)[0] || 'static';
}

function categoryPath(category: SitemapCategory, categoriesById: Map<number, SitemapCategory>): string | null {
  if (!category.parent) return `/${category.slug}`;
  const parent = categoriesById.get(category.parent);
  return parent ? `/${parent.slug}/${category.slug}` : null;
}

export function buildFallbackPostEntries({
  baseUrl,
  categories,
  posts,
}: {
  baseUrl: string;
  categories: SitemapCategory[];
  posts: SitemapFallbackPost[];
}): SitemapCmsItem[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return posts.flatMap((post): SitemapCmsItem[] => {
    const assignedIds = new Set(post.categories);
    const assignedChildren = categories
      .filter((category) => category.parent && assignedIds.has(category.id) && categoryById.has(category.parent))
      .sort((a, b) => a.id - b.id);
    const child = assignedChildren[0];
    if (child) {
      const parent = categoryById.get(child.parent);
      if (!parent) return [];
      return [{
        url: `${normalizeBaseUrl(baseUrl).origin}/${parent.slug}/${child.slug}/${post.slug}`,
        modified: post.modified,
      }];
    }

    const root = categories
      .filter((category) => !category.parent && assignedIds.has(category.id))
      .sort((a, b) => a.id - b.id)[0];
    return root ? [{
      url: `${normalizeBaseUrl(baseUrl).origin}/${root.slug}/${post.slug}`,
      modified: post.modified,
    }] : [];
  });
}

export function buildSitemapGroups({
  baseUrl,
  staticPaths,
  categories,
  cmsItems,
  busCodes,
}: {
  baseUrl: string;
  staticPaths: string[];
  categories: SitemapCategory[];
  cmsItems: SitemapCmsItem[];
  busCodes: string[];
}): SitemapGroup[] {
  const staticUrls = new Set(
    staticPaths
      .map((path) => normalizeCanonicalUrl(path, baseUrl))
      .filter((url): url is string => Boolean(url)),
  );
  const records = new Map<string, SitemapEntry & { group: string }>();

  const addEntry = (rawUrl: string, group: string, modified?: string) => {
    const url = normalizeCanonicalUrl(rawUrl, baseUrl);
    if (!url) return;
    const lastModified = toIsoDate(modified);
    const existing = records.get(url);
    records.set(url, {
      url,
      group: existing?.group || group,
      ...(latestDate([existing?.lastModified, lastModified])
        ? { lastModified: latestDate([existing?.lastModified, lastModified]) }
        : {}),
    });
  };

  for (const url of staticUrls) addEntry(url, 'static');

  const normalizedCmsItems = cmsItems.flatMap((item) => {
    const url = normalizeCanonicalUrl(item.url, baseUrl);
    if (!url || (item.type === 'page' && !staticUrls.has(url))) return [];
    return [{ url, modified: item.modified }];
  });
  for (const item of normalizedCmsItems) {
    addEntry(item.url, staticUrls.has(item.url) ? 'static' : firstPathSegment(item.url), item.modified);
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  for (const category of categories.filter((item) => item.count > 0)) {
    const path = categoryPath(category, categoriesById);
    if (!path) continue;
    const url = normalizeCanonicalUrl(path, baseUrl);
    if (!url) continue;
    const categoryLastModified = latestDate(
      normalizedCmsItems
        .filter((item) => item.url.startsWith(`${url}/`))
        .map((item) => toIsoDate(item.modified)),
    );
    addEntry(url, firstPathSegment(url), categoryLastModified);
  }

  addEntry('/otobus-hatlari', 'otobus-hatlari');
  for (const code of new Set(busCodes.map((value) => value.trim().toLowerCase()).filter(Boolean))) {
    if (/^[a-z0-9-]+$/.test(code)) addEntry(`/otobus-hatlari/${code}`, 'otobus-hatlari');
  }

  const grouped = new Map<string, SitemapEntry[]>();
  for (const { group, ...entry } of records.values()) {
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(entry);
  }

  return [...grouped.entries()]
    .map(([name, entries]): SitemapGroup => {
      entries.sort((a, b) => a.url.localeCompare(b.url));
      const lastModified = latestDate(entries.map((entry) => entry.lastModified));
      return { name, entries, ...(lastModified ? { lastModified } : {}) };
    })
    .filter((group) => group.entries.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function serializeUrlSet(entries: SitemapEntry[]): string {
  const rows = entries.map((entry) => [
    '  <url>',
    `    <loc>${escapeXml(entry.url)}</loc>`,
    ...(entry.lastModified ? [`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`] : []),
    '  </url>',
  ].join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

export function serializeSitemapIndex(groups: SitemapGroup[], baseUrl: string): string {
  const origin = normalizeBaseUrl(baseUrl).origin;
  const rows = groups.map((group) => [
    '  <sitemap>',
    `    <loc>${escapeXml(`${origin}/sitemaps/${encodeURIComponent(group.name)}.xml`)}</loc>`,
    ...(group.lastModified ? [`    <lastmod>${escapeXml(group.lastModified)}</lastmod>`] : []),
    '  </sitemap>',
  ].join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</sitemapindex>\n`;
}
