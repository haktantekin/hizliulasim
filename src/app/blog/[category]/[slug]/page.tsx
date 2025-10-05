import Image from "next/image";
import { fetchPostBySlug, fetchCategories, fetchPosts } from "@/services/wordpress";
import type { Metadata } from "next";
import PostListItem from "@/components/blog/PostListItem";
import Breadcrumb from "@/components/ui/Breadcrumb";

export default async function BlogPostPage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { slug, category } = await params;
  const post = await fetchPostBySlug(slug);
  const categories = await fetchCategories();
  const cat = categories.find((c) => c.slug === category) || null;
  // Related posts from the same category (by date desc)
  let relatedPosts: Awaited<ReturnType<typeof fetchPosts>> = [];
  if (post && post.categoryIds && post.categoryIds.length > 0) {
    try {
      const fetched = await fetchPosts({
        categoryId: post.categoryIds[0],
        per_page: 6,
        orderby: 'date',
        order: 'desc',
      });
      relatedPosts = fetched.filter((p) => p.id !== post.id);
    } catch {
      relatedPosts = [];
    }
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="text-center text-gray-600">Yazı bulunamadı.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: "Blog", href: "/blog" },
          ...(cat ? [{ label: cat.name, href: `/blog/${cat.slug}` }] : []),
          // current page omitted per request
        ]}
      />

      <h1 className="text-2xl font-bold mb-4">{post.title}</h1>


      {post.featuredImage && (
        <div className="relative w-full h-64 md:h-96 mb-6">
          <Image src={post.featuredImage.url} alt={post.featuredImage.alt} fill className="object-cover rounded-lg" priority />
        </div>
      )}
      <div className="text-xs text-gray-500 mb-4">
        <span>{new Date(post.publishedAt).toLocaleDateString('tr-TR')}</span>
      </div>
      <article className="post-detail">
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt || post.title,
            datePublished: post.publishedAt,
            dateModified: post.modifiedAt || post.publishedAt,
            author: post.author?.name ? { '@type': 'Person', name: post.author.name } : undefined,
            image: post.featuredImage?.url,
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `/blog/${category}/${post.slug}`,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Ana Sayfa',
                item: '/',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Blog',
                item: '/blog',
              },
              ...(cat
                ? [
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: cat.name,
                    item: `/blog/${cat.slug}`,
                  },
                ]
                : []),
            ],
          }),
        }}
      />
      {relatedPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">İlgili İçerikler</h2>
          <div className="divide-y divide-gray-200">
            {relatedPosts.map((rp) => (
              <PostListItem
                key={rp.id}
                post={rp}
                href={`/blog/${(cat?.slug || category)}/${rp.slug}`}
                className="py-3"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug, category } = await params;
  const post = await fetchPostBySlug(slug);
  // Fallbacks if post not found
  if (!post) {
    return {
      title: 'Yazı bulunamadı - Blog',
      description: 'Aradığınız blog yazısı bulunamadı.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = post.title;
  const description = post.excerpt || post.title;
  const canonical = `/blog/${category}/${post.slug}`;
  const images = post.featuredImage
    ? [
      {
        url: post.featuredImage.url,
        width: post.featuredImage.width,
        height: post.featuredImage.height,
        alt: post.featuredImage.alt,
      },
    ]
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
      },
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt || post.publishedAt,
      authors: post.author?.name ? [post.author.name] : undefined,
      images,
    },
    twitter: {
      card: post.featuredImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: post.featuredImage ? [post.featuredImage.url] : undefined,
    },
    keywords: post.tags && post.tags.length ? post.tags.map(String) : undefined,
    authors: post.author?.name ? [{ name: post.author.name }] : undefined,
  };
}
