import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hizliulasim.com';

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/harita`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/gezi`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/kesfet`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/kategoriler`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/iletisim`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/gizlilik-politikasi`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cerez-politikasi`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/kunye`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Fetch blog posts from WordPress API
  let blogRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];

  try {
    // Fetch all posts
    const postsRes = await fetch(
      'https://cms.hizliulasim.com/wp-json/wp/v2/posts?per_page=100&_embed',
      { next: { revalidate: 3600 } } // Revalidate every hour
    );

    if (postsRes.ok) {
      const posts: Array<{
        slug: string;
        modified: string;
        _embedded?: {
          'wp:term'?: Array<Array<{ slug: string }>>;
        };
      }> = await postsRes.json();
      
      blogRoutes = posts.map((post) => {
        // Extract category slug from embedded data
        const categories = post._embedded?.['wp:term']?.[0] || [];
        const categorySlug = categories[0]?.slug || 'genel';

        return {
          url: `${baseUrl}/blog/${categorySlug}/${post.slug}`,
          lastModified: new Date(post.modified),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        };
      });
    }

    // Fetch all categories
    const categoriesRes = await fetch(
      'https://cms.hizliulasim.com/wp-json/wp/v2/categories?per_page=100',
      { next: { revalidate: 3600 } }
    );

    if (categoriesRes.ok) {
      const categories: Array<{
        slug: string;
        count: number;
      }> = await categoriesRes.json();
      
      categoryRoutes = categories
        .filter((cat) => cat.count > 0) // Only categories with posts
        .map((cat) => ({
          url: `${baseUrl}/blog/${cat.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
    }
  } catch (error) {
    console.error('Error fetching blog data for sitemap:', error);
  }

  return [...staticRoutes, ...categoryRoutes, ...blogRoutes];
}
