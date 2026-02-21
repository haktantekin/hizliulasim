import Image from 'next/image';
import {
  fetchCategoryBySlug,
  fetchCategories,
  fetchPosts,
  fetchPostBySlug,
} from '@/services/wordpress';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import SubCategoryClient from './SubCategoryClient';
import Breadcrumb from '@/components/ui/Breadcrumb';
import PostListItem from '@/components/blog/PostListItem';
import PostLocationMap from '@/components/blog/PostLocationMap';
import { Fragment } from 'react';
import { getDummyImageForCategory } from '@/lib/getDummyImage';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

type PageProps = {
  params: Promise<{ mainCategory: string; category: string }>;
};

/* ─────────────────────── Metadata ─────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mainCategory, category: categorySlug } = await params;

  // try both: the slug may refer to a sub-category OR a post
  const [cat, post] = await Promise.all([
    fetchCategoryBySlug(categorySlug),
    fetchPostBySlug(categorySlug),
  ]);

  // 1) Sub-category page metadata
  if (cat) {
    const description =
      cat.description || `${cat.name} kategorisindeki tüm blog yazıları ve içerikler.`;
    return {
      title: cat.name,
      description,
      alternates: { canonical: `${SITE_URL}/${mainCategory}/${cat.slug}` },
      openGraph: {
        title: `${cat.name} | Hızlı Ulaşım`,
        description,
        url: `${SITE_URL}/${mainCategory}/${cat.slug}`,
        type: 'website',
        siteName: 'Hızlı Ulaşım',
        locale: 'tr_TR',
      },
      twitter: {
        card: 'summary',
        title: `${cat.name} | Hızlı Ulaşım`,
        description,
      },
    };
  }

  // 2) Post detail fallback metadata
  if (post) {
    const title = post.title;
    const description = post.excerpt || post.title;
    const canonical = `${SITE_URL}/${mainCategory}/${post.slug}`;
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
      alternates: { canonical },
      robots: { index: true, follow: true },
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
      keywords: post.tags?.length ? post.tags.map(String) : undefined,
      authors: post.author?.name ? [{ name: post.author.name }] : undefined,
    };
  }

  // 3) Neither found
  return {
    title: 'Bulunamadı',
    robots: { index: false, follow: false },
  };
}

/* ─────────────────────── Page Component ─────────────────────── */

export default async function SubCategoryPage({ params }: PageProps) {
  const { mainCategory: mainCategorySlug, category: categorySlug } = await params;

  // Parallel fetch: category, post, allCategories
  const [category, post, allCategories] = await Promise.all([
    fetchCategoryBySlug(categorySlug),
    fetchPostBySlug(categorySlug),
    fetchCategories(),
  ]);

  const mainCategory = allCategories.find((c) => c.slug === mainCategorySlug) || null;

  /* ────── CASE 1: Sub-category listing ────── */
  if (category) {
    const initialPosts = await fetchPosts({
      categoryId: category.id,
      per_page: 20,
      orderby: 'date',
      order: 'desc',
    });

    const parentCategory = category.parentId
      ? allCategories.find((c) => c.id === category.parentId)
      : null;
    const mainCatForSchema = parentCategory || mainCategory;

    return (
      <>
        {/* JSON-LD: CollectionPage */}
        <Script
          id={`schema-collection-${category.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: category.name,
              description:
                category.description || `${category.name} kategorisindeki yazılar`,
              url: `${SITE_URL}/${mainCategorySlug}/${category.slug}`,
              isPartOf: {
                '@type': 'WebSite',
                name: 'Hızlı Ulaşım',
                url: SITE_URL,
              },
              ...(initialPosts.length > 0 && {
                mainEntity: {
                  '@type': 'ItemList',
                  numberOfItems: initialPosts.length,
                  itemListElement: initialPosts.slice(0, 10).map((p, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    url: `${SITE_URL}/${mainCategorySlug}/${category.slug}/${p.slug}`,
                    name: p.title,
                  })),
                },
              }),
            }),
          }}
        />
        {/* JSON-LD: BreadcrumbList */}
        <Script
          id={`schema-breadcrumb-${category.slug}`}
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
                  item: SITE_URL,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Kategoriler',
                  item: `${SITE_URL}/kategoriler`,
                },
                ...(mainCatForSchema
                  ? [
                      {
                        '@type': 'ListItem',
                        position: 3,
                        name: mainCatForSchema.name,
                        item: `${SITE_URL}/${mainCatForSchema.slug}`,
                      },
                    ]
                  : []),
                {
                  '@type': 'ListItem',
                  position: mainCatForSchema ? 4 : 3,
                  name: category.name,
                  item: `${SITE_URL}/${mainCategorySlug}/${category.slug}`,
                },
              ],
            }),
          }}
        />
        <SubCategoryClient
          category={category}
          mainCategory={mainCatForSchema || category}
          allCategories={allCategories}
          initialPosts={initialPosts}
          mainCategorySlug={mainCategorySlug}
        />
      </>
    );
  }

  /* ────── CASE 2: Post detail (slug matched a post, not a category) ────── */
  if (post) {
    const postCategoryId = post.categoryIds?.[0];
    const postCategory = postCategoryId
      ? allCategories.find((c) => c.id === postCategoryId)
      : null;
    const postMainCategory = postCategory?.parentId
      ? allCategories.find((c) => c.id === postCategory.parentId)
      : mainCategory;

    // Related posts
    let relatedPosts: Awaited<ReturnType<typeof fetchPosts>> = [];
    if (post.categoryIds?.length) {
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

    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: 'Kategoriler', href: '/kategoriler' },
            ...(postMainCategory
              ? [{ label: postMainCategory.name, href: `/${postMainCategory.slug}` }]
              : []),
            ...(postCategory && postMainCategory && postCategory.parentId
              ? [
                  {
                    label: postCategory.name,
                    href: `/${postMainCategory.slug}/${postCategory.slug}`,
                  },
                ]
              : []),
          ]}
        />

        <h1 className="text-2xl font-bold mb-4 text-brand-soft-blue">{post.title}</h1>

        {post.featuredImage ? (
          <div className="relative w-full h-64 md:h-96 mb-6">
            <Image
              src={post.featuredImage.url}
              alt={post.featuredImage.alt}
              fill
              className="object-cover rounded-lg"
              priority
              sizes="100vw"
            />
          </div>
        ) : (() => {
          const dummyImage = getDummyImageForCategory(postMainCategory?.slug, post.title);
          return dummyImage ? (
            <div className="relative w-full h-64 md:h-96 mb-6">
              <Image
                src={dummyImage.url}
                alt={dummyImage.alt}
                fill
                className="object-cover rounded-lg"
                priority
                sizes="100vw"
              />
            </div>
          ) : null;
        })()}

        <div className="text-xs text-gray-500 mb-4">
          <span>{new Date(post.publishedAt).toLocaleDateString('tr-TR')}</span>
        </div>

        <article className="post-detail space-y-6">
          {post.location && post.content.includes('[map]') ? (
            post.content.split('[map]').map((part, idx, arr) => (
              <Fragment key={`content-part-${idx}`}>
                {part && <div dangerouslySetInnerHTML={{ __html: part }} />}
                {idx < arr.length - 1 && post.location && (
                  <PostLocationMap
                    latitude={post.location.latitude}
                    longitude={post.location.longitude}
                    title={post.title}
                  />
                )}
              </Fragment>
            ))
          ) : (
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          )}
        </article>

        {!post.content.includes('[map]') && post.location && (
          <PostLocationMap
            latitude={post.location.latitude}
            longitude={post.location.longitude}
            title={post.title}
          />
        )}

        {/* JSON-LD: BlogPosting */}
        <Script
          id={`schema-post-${post.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.excerpt || post.title,
              datePublished: post.publishedAt,
              dateModified: post.modifiedAt || post.publishedAt,
              author: post.author?.name
                ? { '@type': 'Person', name: post.author.name }
                : undefined,
              image: post.featuredImage?.url,
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `${SITE_URL}/${mainCategorySlug}/${post.slug}`,
              },
            }),
          }}
        />
        {/* JSON-LD: BreadcrumbList */}
        <Script
          id={`schema-breadcrumb-post-${post.slug}`}
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
                  item: SITE_URL,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Kategoriler',
                  item: `${SITE_URL}/kategoriler`,
                },
                ...(postMainCategory
                  ? [
                      {
                        '@type': 'ListItem',
                        position: 3,
                        name: postMainCategory.name,
                        item: `${SITE_URL}/${postMainCategory.slug}`,
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
              {relatedPosts.map((rp) => {
                const rpCategoryId = rp.categoryIds?.[0];
                const rpCategory = rpCategoryId
                  ? allCategories.find((c) => c.id === rpCategoryId)
                  : null;
                const rpMainCategory = rpCategory?.parentId
                  ? allCategories.find((c) => c.id === rpCategory.parentId)
                  : postMainCategory;
                const href =
                  rpMainCategory && rpCategory
                    ? `/${rpMainCategory.slug}/${rpCategory.slug}/${rp.slug}`
                    : `/${mainCategorySlug}/${rp.slug}`;

                return (
                  <PostListItem
                    key={rp.id}
                    post={rp}
                    href={href}
                    className="py-3"
                    categorySlug={rpCategory?.slug}
                    categoryName={rpCategory?.name}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ────── Neither category nor post found ────── */
  notFound();
}
