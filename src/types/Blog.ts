export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  postCount: number;
  color: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categorySlug: string;
  author: {
    name: string;
    avatar?: string;
  };
  publishedAt: string;
  readTime: number;
  tags: string[];
  featuredImage?: string;
}

export interface BlogData {
  categories: BlogCategory[];
  posts: BlogPost[];
}