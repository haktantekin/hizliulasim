import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hizliulasim.com';

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0, // Ana sayfa en yüksek
    },
    {
      url: `${baseUrl}/kategoriler`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95, // Kategoriler ana sayfa çok önemli
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
      priority: 0.85,
    },
    {
      url: `${baseUrl}/kategoriler`,
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
    // Fetch all categories first
    const categoriesRes = await fetch(
      'https://cms.hizliulasim.com/wp-json/wp/v2/categories?per_page=100',
      { next: { revalidate: 3600 } }
    );

    let allCategoriesMap: Record<number, { slug: string; parent?: number }> = {};
    
    if (categoriesRes.ok) {
      const categories: Array<{
        id: number;
        slug: string;
        parent?: number;
        count: number;
      }> = await categoriesRes.json();
      
      // Build categories map for quick lookup
      allCategoriesMap = categories.reduce((acc, cat) => {
        acc[cat.id] = { slug: cat.slug, parent: cat.parent };
        return acc;
      }, {} as Record<number, { slug: string; parent?: number }>);
      
      categoryRoutes = categories
        .filter((cat) => cat.count > 0) // Only categories with posts
        .map((cat) => ({
          url: `${baseUrl}/${cat.slug}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const, // Kategoriler sık güncellenir
          priority: 0.75,
        }));
    }

    // Fetch all posts
    const postsRes = await fetch(
      'https://cms.hizliulasim.com/wp-json/wp/v2/posts?per_page=100&_embed',
      { next: { revalidate: 3600 } } // Revalidate every hour
    );

    if (postsRes.ok) {
      const posts: Array<{
        slug: string;
        modified: string;
        categories: number[];
        _embedded?: {
          'wp:term'?: Array<Array<{ slug: string }>>;
        };
      }> = await postsRes.json();
      
      blogRoutes = posts.map((post) => {
        // Get the first category ID
        const categoryId = post.categories?.[0];
        let url = `${baseUrl}/${post.slug}`;
        
        if (categoryId && allCategoriesMap[categoryId]) {
          const category = allCategoriesMap[categoryId];
          
          // If category has a parent, build main/sub URL
          if (category.parent && allCategoriesMap[category.parent]) {
            const parentCategory = allCategoriesMap[category.parent];
            url = `${baseUrl}/${parentCategory.slug}/${category.slug}/${post.slug}`;
          } else {
            // Just main category
            url = `${baseUrl}/${category.slug}/${post.slug}`;
          }
        }

        return {
          url,
          lastModified: new Date(post.modified),
          changeFrequency: 'weekly' as const,
          priority: 0.8, // Blog yazıları önemli
        };
      });
    }
  } catch (error) {
    console.error('Error fetching blog data for sitemap:', error);
  }

  return [...staticRoutes, ...categoryRoutes, ...blogRoutes];
}
