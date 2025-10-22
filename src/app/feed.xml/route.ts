import { fetchPosts } from '@/services/wordpress';

export async function GET() {
  const baseUrl = 'https://hizliulasim.com';
  
  try {
    const posts = await fetchPosts({ per_page: 50, orderby: 'date', order: 'desc' });

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Hızlı Ulaşım Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Ulaşım, gezi ve şehir yaşamı hakkında blog yazıları</description>
    <language>tr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(post => {
      const pubDate = new Date(post.publishedAt).toUTCString();
      const link = `${baseUrl}/blog/${post.slug}`;
      
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
