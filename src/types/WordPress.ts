// WordPress API Response Types
export interface WPCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
  meta: Record<string, unknown>[];
  _links: {
    self: Array<{ href: string }>;
    collection: Array<{ href: string }>;
    about: Array<{ href: string }>;
    "wp:post_type": Array<{ href: string }>;
    curies: Array<{ name: string; href: string; templated: boolean }>;
  };
}

export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  guid: {
    rendered: string;
  };
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
    protected: boolean;
  };
  excerpt: {
    rendered: string;
    protected: boolean;
  };
  author: number;
  featured_media: number;
  comment_status: string;
  ping_status: string;
  sticky: boolean;
  template: string;
  format: string;
  meta: Record<string, unknown>[];
  categories: number[];
  tags: number[];
  _embedded?: {
    author?: WPAuthor[];
    'wp:featuredmedia'?: WPMedia[];
  };
  _links: {
    self: Array<{ href: string }>;
    collection: Array<{ href: string }>;
    about: Array<{ href: string }>;
    author: Array<{ embeddable: boolean; href: string }>;
    replies: Array<{ embeddable: boolean; href: string }>;
    "version-history": Array<{ count: number; href: string }>;
    "predecessor-version": Array<{ id: number; href: string }>;
    "wp:featuredmedia": Array<{ embeddable: boolean; href: string }>;
    "wp:attachment": Array<{ href: string }>;
    "wp:term": Array<{ taxonomy: string; embeddable: boolean; href: string }>;
    curies: Array<{ name: string; href: string; templated: boolean }>;
  };
}

export interface WPAuthor {
  id: number;
  name: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  avatar_urls: {
    [key: string]: string;
  };
  meta: Record<string, unknown>[];
  _links: {
    self: Array<{ href: string }>;
    collection: Array<{ href: string }>;
  };
}

export interface WPMedia {
  id: number;
  date: string;
  date_gmt: string;
  guid: {
    rendered: string;
  };
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: {
    rendered: string;
  };
  author: number;
  comment_status: string;
  ping_status: string;
  template: string;
  meta: Record<string, unknown>[];
  description: {
    rendered: string;
  };
  caption: {
    rendered: string;
  };
  alt_text: string;
  media_type: string;
  mime_type: string;
  media_details: {
    width: number;
    height: number;
    file: string;
    sizes: {
      [key: string]: {
        file: string;
        width: number;
        height: number;
        mime_type: string;
        source_url: string;
      };
    };
    image_meta: Record<string, unknown>;
  };
  source_url: string;
  _links: Record<string, unknown>;
}

// Transformed types for our application
export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  postCount: number;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryIds: number[];
  author: {
    id: number;
    name: string;
    avatar?: string;
  };
  publishedAt: string;
  modifiedAt?: string;
  featuredImage?: {
    url: string;
    alt: string;
    width: number;
    height: number;
  };
  tags: number[];
}