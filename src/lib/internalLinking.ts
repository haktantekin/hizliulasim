import type { BlogCategory } from '../types/WordPress';

export type InternalLinkCandidate = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryIds: number[];
  publishedAt: string;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export type RankedInternalLink = {
  post: InternalLinkCandidate;
  href: string;
  score: number;
  categoryId: number;
};

const TURKISH_STOP_WORDS = new Set([
  'acaba', 'icin', 'ile', 'mi', 'mı', 'mu', 'mü', 'nasıl', 'nasil', 'nerede',
  'rehberi', 'saatleri', 'tarifi', 've', 'veya', 'yol', 'ulaşım', 'ulasim',
]);

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meaningfulTokens(value: string): string[] {
  return normalizeText(value)
    .split(/[\s-]+/)
    .filter((token) => token.length > 2 && !TURKISH_STOP_WORDS.has(token));
}

function entityKey(title: string): string {
  return meaningfulTokens(title).join(' ');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (match, hex: string, decimal: string) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    });
}

function extractTableValue(html: string, labels: string[]): string | null {
  const cells = [...html.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)]
    .map((match) => normalizeText(decodeBasicEntities(match[1].replace(/<[^>]+>/g, ' '))))
    .filter(Boolean);

  const normalizedLabels = new Set(labels.map(normalizeText));
  for (let index = 0; index < cells.length - 1; index += 1) {
    if (normalizedLabels.has(cells[index])) return cells[index + 1];
  }
  return null;
}

function getPlaceSignals(post: InternalLinkCandidate) {
  const normalizedExcerpt = normalizeText(decodeBasicEntities(post.excerpt));
  const districtFromExcerpt = normalizedExcerpt.match(/\b([a-z0-9]+) ilcesi(?:nde|ne|nin|nden)?\b/)?.[1] || null;
  return {
    district: extractTableValue(post.content, ['Bulunduğu ilçe', 'İlçe']) || districtFromExcerpt,
    city: extractTableValue(post.content, ['Bulunduğu şehir', 'Şehir', 'İl']),
  };
}

function distanceInKm(
  first: NonNullable<InternalLinkCandidate['location']>,
  second: NonNullable<InternalLinkCandidate['location']>,
): number {
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function resolveRouteCategory({
  post,
  categories,
  preferredRootCategoryId,
}: {
  post: InternalLinkCandidate;
  categories: BlogCategory[];
  preferredRootCategoryId?: number;
}): { leaf: BlogCategory; root: BlogCategory } | null {
  const assignedIds = new Set(post.categoryIds);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const assignedChildren = categories
    .filter((category) => category.parentId && assignedIds.has(category.id))
    .filter((category) => categoryById.has(category.parentId!));

  const preferredChild = preferredRootCategoryId
    ? assignedChildren.find((category) => category.parentId === preferredRootCategoryId)
    : undefined;
  const leaf = preferredChild || assignedChildren.sort((a, b) => a.id - b.id)[0];
  if (leaf?.parentId) {
    const root = categoryById.get(leaf.parentId);
    return root ? { leaf, root } : null;
  }

  const assignedRoots = categories
    .filter((category) => !category.parentId && assignedIds.has(category.id))
    .sort((a, b) => {
      if (a.id === preferredRootCategoryId) return -1;
      if (b.id === preferredRootCategoryId) return 1;
      return a.id - b.id;
    });
  const root = assignedRoots[0];
  return root ? { leaf: root, root } : null;
}

export function buildInternalPostPath({
  post,
  categories,
  preferredRootCategoryId,
}: {
  post: InternalLinkCandidate;
  categories: BlogCategory[];
  preferredRootCategoryId?: number;
}): string | null {
  const routeCategory = resolveRouteCategory({ post, categories, preferredRootCategoryId });
  if (!routeCategory) return null;

  return routeCategory.leaf.id === routeCategory.root.id
    ? `/${routeCategory.root.slug}/${post.slug}`
    : `/${routeCategory.root.slug}/${routeCategory.leaf.slug}/${post.slug}`;
}

function scoreCandidate(
  currentPost: InternalLinkCandidate,
  candidate: InternalLinkCandidate,
  currentLeafCategoryId: number | undefined,
  candidateLeafCategoryId: number,
): number {
  let score = 0;
  const currentEntity = entityKey(currentPost.title);
  const candidateEntity = entityKey(candidate.title);
  if (currentEntity && currentEntity === candidateEntity) score += 100;

  const currentSignals = getPlaceSignals(currentPost);
  const candidateSignals = getPlaceSignals(candidate);
  if (currentSignals.district && currentSignals.district === candidateSignals.district) score += 50;
  if (currentSignals.city && currentSignals.city === candidateSignals.city) score += 25;

  if (currentPost.location && candidate.location) {
    const distance = distanceInKm(currentPost.location, candidate.location);
    if (distance <= 3) score += 35;
    else if (distance <= 15) score += 20;
  }

  if (currentLeafCategoryId === candidateLeafCategoryId) score += 24;
  else score += 10;

  const currentTokens = new Set(meaningfulTokens(currentPost.title));
  const sharedTokenCount = new Set(meaningfulTokens(candidate.title).filter((token) => currentTokens.has(token))).size;
  score += Math.min(sharedTokenCount * 8, 32);
  return score;
}

export function rankInternalLinks({
  currentPost,
  candidates,
  categories,
  preferredRootCategoryId,
  limit = 6,
}: {
  currentPost: InternalLinkCandidate;
  candidates: InternalLinkCandidate[];
  categories: BlogCategory[];
  preferredRootCategoryId?: number;
  limit?: number;
}): RankedInternalLink[] {
  const safeLimit = Math.min(8, Math.max(4, limit));
  const currentRoute = resolveRouteCategory({ post: currentPost, categories, preferredRootCategoryId });
  const seenPaths = new Set<string>();
  const ranked = candidates
    .filter((post) => post.id !== currentPost.id)
    .flatMap((post): RankedInternalLink[] => {
      const routeCategory = resolveRouteCategory({ post, categories, preferredRootCategoryId });
      const href = buildInternalPostPath({ post, categories, preferredRootCategoryId });
      if (!routeCategory || !href || seenPaths.has(href)) return [];
      seenPaths.add(href);
      return [{
        post,
        href,
        categoryId: routeCategory.leaf.id,
        score: scoreCandidate(currentPost, post, currentRoute?.leaf.id, routeCategory.leaf.id),
      }];
    })
    .sort((a, b) => b.score - a.score
      || Date.parse(b.post.publishedAt) - Date.parse(a.post.publishedAt)
      || a.post.id - b.post.id);

  const selected: RankedInternalLink[] = [];
  const categoryCounts = new Map<number, number>();
  for (const item of ranked) {
    if ((categoryCounts.get(item.categoryId) || 0) >= 3) continue;
    selected.push(item);
    categoryCounts.set(item.categoryId, (categoryCounts.get(item.categoryId) || 0) + 1);
    if (selected.length === safeLimit) return selected;
  }

  for (const item of ranked) {
    if (selected.includes(item)) continue;
    selected.push(item);
    if (selected.length === safeLimit) break;
  }
  return selected;
}
