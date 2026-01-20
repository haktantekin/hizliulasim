import { WPCategory, WPPost, WPAuthor, WPMedia, BlogCategory, BlogPost } from '../types/WordPress';

const API_BASE_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://cms.hizliulasim.com/wp-json/wp/v2';
// Minimal Page type including Yoast head json if available
type WPPage = {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  excerpt?: { rendered: string; protected: boolean };
  yoast_head_json?: {
    title?: string;
    description?: string;
    canonical?: string;
    og_title?: string;
    og_description?: string;
    og_type?: string;
    og_url?: string;
    og_image?: Array<{ url: string; width?: number; height?: number; alt?: string }>;
    twitter_card?: string;
    twitter_misc?: Record<string, unknown>;
    robots?: { index?: 'index' | 'noindex'; follow?: 'follow' | 'nofollow' };
  };
};

export type PageSEO = {
  title?: string;
  description?: string;
  canonical?: string;
  ogImages?: Array<{ url: string; width?: number; height?: number; alt?: string }>;
  robots?: { index?: boolean; follow?: boolean };
};

// Fetch a single WP Page by slug and extract Yoast SEO info
export const fetchPageSeoBySlug = async (slug: string): Promise<PageSEO | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/pages?slug=${encodeURIComponent(slug)}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    const pages: WPPage[] = await res.json();
    if (!Array.isArray(pages) || pages.length === 0) return null;
    const p = pages[0];
    const y = p.yoast_head_json;
    const title = y?.title || (p.title?.rendered ? stripHtml(p.title.rendered) : undefined);
    const description = y?.description || (p.excerpt?.rendered ? stripHtml(p.excerpt.rendered) : undefined);
    const canonical = y?.canonical || p.link;
    const ogImages = y?.og_image;
    return { title, description, canonical, ogImages };
  } catch (err) {
    console.error('Error fetching page SEO:', err);
    return null;
  }
};

// Helper function to clean HTML from WordPress content
const stripHtml = (html: string): string => {
  if (typeof window !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }
  // Server-side HTML stripping (basic)
  return html.replace(/<[^>]*>/g, '');
};

// Decode common HTML entities (numeric + named) from WP titles/excerpts
const decodeHtml = (input: string): string => {
  // Numeric entities
  let s = input.replace(/&#(x?)([0-9a-fA-F]+);/g, (_match, hex: string, code: string) => {
    const cp = hex ? parseInt(code, 16) : parseInt(code, 10);
    if (!Number.isFinite(cp)) return _match as string;
    try {
      return String.fromCharCode(cp);
    } catch {
      return _match as string;
    }
  });
  // Named entities (common subset)
  s = s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return s;
};

// Fetch categories from WordPress
export const fetchCategories = async (): Promise<BlogCategory[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/categories?per_page=100&hide_empty=true`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const categories: WPCategory[] = await response.json();
    
    return categories
      .filter(category => category.slug !== 'uncategorized') // Remove default category
      .map((category): BlogCategory => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: stripHtml(category.description) || `${category.name} kategorisindeki yazılar`,
        postCount: category.count,
        parentId: category.parent || undefined,
      }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Kategoriler yüklenirken bir hata oluştu');
  }
};

// Fetch posts from WordPress
export const fetchPosts = async (params?: {
  categoryId?: number;
  per_page?: number;
  page?: number;
  search?: string;
  orderby?: string; // e.g., 'date'
  order?: 'asc' | 'desc';
}): Promise<BlogPost[]> => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params?.categoryId) queryParams.append('categories', params.categoryId.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());
    if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.orderby) queryParams.append('orderby', params.orderby);
  if (params?.order) queryParams.append('order', params.order);
    
    // Always embed author and featured media
    queryParams.append('_embed', 'author,wp:featuredmedia');
    
    const response = await fetch(`${API_BASE_URL}/posts?${queryParams.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 }, // Revalidate every 5 minutes
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const posts: WPPost[] = await response.json();
    
    return posts.map((post): BlogPost => {
      // Get embedded author data
      const authorData = post._embedded?.['author']?.[0] as WPAuthor;
      
      // Get embedded featured media
      const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0] as WPMedia;

      // Parse location from meta
      let location: { latitude: number; longitude: number } | undefined = undefined;
      
      if (post.meta?._hizliulasim_latitude && post.meta?._hizliulasim_longitude) {
        // WordPress meta can be string or array
        let latStr = post.meta._hizliulasim_latitude;
        let lngStr = post.meta._hizliulasim_longitude;
        
        // If array, get first element
        if (Array.isArray(latStr)) latStr = latStr[0];
        if (Array.isArray(lngStr)) lngStr = lngStr[0];
        
        const lat = parseFloat(latStr as string);
        const lng = parseFloat(lngStr as string);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          location = { latitude: lat, longitude: lng };
        }
      }

      return {
        id: post.id,
        title: decodeHtml(stripHtml(post.title.rendered)),
        slug: post.slug,
        excerpt: decodeHtml(stripHtml(post.excerpt.rendered)),
  // Decode in case content is entity-escaped (e.g., &lt;p&gt;...)
  content: decodeHtml(post.content.rendered),
        categoryIds: post.categories,
        author: {
          id: post.author,
          name: authorData?.name || 'Bilinmeyen Yazar',
          avatar: authorData?.avatar_urls?.['96'] || undefined,
        },
        publishedAt: post.date,
        modifiedAt: post.modified,
        featuredImage: featuredMedia ? {
          url: featuredMedia.source_url,
          alt: featuredMedia.alt_text || post.title.rendered,
          width: featuredMedia.media_details?.width || 800,
          height: featuredMedia.media_details?.height || 600,
        } : undefined,
        tags: post.tags,
        location,
      };
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw new Error('Gönderiler yüklenirken bir hata oluştu');
  }
};

// Fetch single post by slug
export const fetchPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/posts?slug=${slug}&_embed=author,wp:featuredmedia`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const posts: WPPost[] = await response.json();
    
    if (posts.length === 0) {
      return null;
    }

    const post = posts[0];
    const authorData = post._embedded?.['author']?.[0] as WPAuthor;
    const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0] as WPMedia;

    // Parse location from meta
    let location: { latitude: number; longitude: number } | undefined = undefined;
    
    if (post.meta?._hizliulasim_latitude && post.meta?._hizliulasim_longitude) {
      // WordPress meta can be string or array
      let latStr = post.meta._hizliulasim_latitude;
      let lngStr = post.meta._hizliulasim_longitude;
      
      // If array, get first element
      if (Array.isArray(latStr)) latStr = latStr[0];
      if (Array.isArray(lngStr)) lngStr = lngStr[0];
      
      const lat = parseFloat(latStr as string);
      const lng = parseFloat(lngStr as string);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        location = { latitude: lat, longitude: lng };
      }
    }

    return {
      id: post.id,
      title: decodeHtml(stripHtml(post.title.rendered)),
      slug: post.slug,
      excerpt: decodeHtml(stripHtml(post.excerpt.rendered)),
  // Decode in case content is entity-escaped
  content: decodeHtml(post.content.rendered),
      categoryIds: post.categories,
      author: {
        id: post.author,
        name: authorData?.name || 'Bilinmeyen Yazar',
        avatar: authorData?.avatar_urls?.['96'] || undefined,
      },
      publishedAt: post.date,
      modifiedAt: post.modified,
      featuredImage: featuredMedia ? {
        url: featuredMedia.source_url,
        alt: featuredMedia.alt_text || post.title.rendered,
        width: featuredMedia.media_details?.width || 800,
        height: featuredMedia.media_details?.height || 600,
      } : undefined,
      tags: post.tags,
      location,
    };
  } catch (error) {
    console.error('Error fetching post by slug:', error);
    return null;
  }
};

// Fetch category by slug
export const fetchCategoryBySlug = async (slug: string): Promise<BlogCategory | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/categories?slug=${slug}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const categories: WPCategory[] = await response.json();
    
    if (categories.length === 0) {
      return null;
    }

    const category = categories[0];
    
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: stripHtml(category.description) || `${category.name} kategorisindeki yazılar`,
      postCount: category.count,
    };
  } catch (error) {
    console.error('Error fetching category by slug:', error);
    return null;
  }
};

// Convenience: recent posts for a category
export const fetchRecentPostsByCategory = async (categoryId: number, limit = 5): Promise<BlogPost[]> => {
  return fetchPosts({ categoryId, per_page: limit });
};