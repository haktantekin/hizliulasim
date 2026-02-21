import { fetchPosts, fetchCategories } from '@/services/wordpress';

export async function GET() {
  const baseUrl = 'https://hizliulasim.com';
  
  try {
    const [posts, categories] = await Promise.all([
      fetchPosts({ per_page: 50, orderby: 'date', order: 'desc' }),
      fetchCategories(),
    ]);

    // Build a category lookup map: id → { slug, parentId }
    const catMap = new Map(categories.map(c => [c.id, c]));

    /** Resolve a post's canonical URL using its category hierarchy */
    function buildPostUrl(post: typeof posts[number]): string {
      const catId = post.categoryIds?.[0];
      if (!catId) return `${baseUrl}/${post.slug}`;

      const cat = catMap.get(catId);
      if (!cat) return `${baseUrl}/${post.slug}`;

      if (cat.parentId) {
        const parent = catMap.get(cat.parentId);
        if (parent) return `${baseUrl}/${parent.slug}/${cat.slug}/${post.slug}`;
      }
      return `${baseUrl}/${cat.slug}/${post.slug}`;
    }

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Hızlı Ulaşım Blog</title>
    <link>${baseUrl}</link>
    <description>Ulaşım, gezi ve şehir yaşamı hakkında blog yazıları</description>
    <language>tr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(post => {
      const pubDate = new Date(post.publishedAt).toUTCString();
      const link = buildPostUrl(post);
      
      return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${post.excerpt || ''}]]></description>
      ${post.featuredImage ? `<enclosure url="${post.featuredImage.url}" type="image/jpeg"/>` : ''}
      ${post.author?.name ? `<author>${post.author.name}</author>` : ''}
    </item>`;
    }).join('')}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('RSS feed error:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}
