import { MetadataRoute } from 'next';
import { getHat } from '@/services/iett';

const API_BASE = 'https://cms.hizliulasim.com/wp-json/wp/v2';

interface WPCategorySitemap {
  id: number;
  slug: string;
  parent?: number;
  count: number;
}

interface WPPostSitemap {
  slug: string;
  modified: string;
  categories: number[];
}

/** Fetch all posts with pagination (WP REST API caps per_page at 100) */
async function fetchAllPosts(
  categoriesMap: Record<number, { slug: string; parent?: number }>,
): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hizliulasim.com';
  const perPage = 100;
  let page = 1;
  const routes: MetadataRoute.Sitemap = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(
      `${API_BASE}/posts?per_page=${perPage}&page=${page}&_fields=slug,modified,categories`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) break;
    const posts: WPPostSitemap[] = await res.json();
    if (posts.length === 0) break;

    for (const post of posts) {
      const categoryId = post.categories?.[0];
      let url = `${baseUrl}/${post.slug}`;

      if (categoryId && categoriesMap[categoryId]) {
        const category = categoriesMap[categoryId];
        if (category.parent && categoriesMap[category.parent]) {
          url = `${baseUrl}/${categoriesMap[category.parent].slug}/${category.slug}/${post.slug}`;
        } else {
          url = `${baseUrl}/${category.slug}/${post.slug}`;
        }
      }

      routes.push({
        url,
        lastModified: new Date(post.modified),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    if (posts.length < perPage) break;
    page++;
  }

  return routes;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hizliulasim.com';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/kategoriler`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/harita`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/gezi`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/kesfet`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/iletisim`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/gizlilik-politikasi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/cerez-politikasi`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/kunye`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  let categoryRoutes: MetadataRoute.Sitemap = [];
  let blogRoutes: MetadataRoute.Sitemap = [];

  try {
    const categoriesRes = await fetch(
      `${API_BASE}/categories?per_page=100&_fields=id,slug,parent,count`,
      { next: { revalidate: 3600 } },
    );

    let allCategoriesMap: Record<number, { slug: string; parent?: number }> = {};

    if (categoriesRes.ok) {
      const categories: WPCategorySitemap[] = await categoriesRes.json();

      allCategoriesMap = categories.reduce((acc, cat) => {
        acc[cat.id] = { slug: cat.slug, parent: cat.parent };
        return acc;
      }, {} as Record<number, { slug: string; parent?: number }>);

      categoryRoutes = categories
        .filter((cat) => cat.count > 0)
        .map((cat) => {
          // Build proper nested URL for sub-categories
          const url = cat.parent && allCategoriesMap[cat.parent]
            ? `${baseUrl}/${allCategoriesMap[cat.parent].slug}/${cat.slug}`
            : `${baseUrl}/${cat.slug}`;
          return {
            url,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.75,
          };
        });
    }

    blogRoutes = await fetchAllPosts(allCategoriesMap);
  } catch (error) {
    console.error('Error fetching blog data for sitemap:', error);
  }

  // ── Otobüs Hatları ──
  let busRoutes: MetadataRoute.Sitemap = [];
  try {
    const hatlar = await getHat();
    busRoutes = [
      {
        url: `${baseUrl}/otobus-hatlari`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
      ...hatlar.map((h) => ({
        url: `${baseUrl}/otobus-hatlari/${h.SHATKODU}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ];
  } catch (error) {
    console.error('Error fetching IETT data for sitemap:', error);
  }

  return [...staticRoutes, ...busRoutes, ...categoryRoutes, ...blogRoutes];
}
