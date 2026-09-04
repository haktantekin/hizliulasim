import Image from 'next/image';
import {
  fetchCategoryBySlug,
  fetchCategories,
  fetchInternalLinkCandidates,
  fetchPosts,
  fetchPostBySlug,
} from '@/services/wordpress';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SubCategoryClient from './SubCategoryClient';
import Breadcrumb from '@/components/ui/Breadcrumb';
import PostLocationMap from '@/components/blog/PostLocationMap';
import { Fragment } from 'react';
import { getDummyImageForCategory } from '@/lib/getDummyImage';
import PostComments from '@/components/blog/PostComments';
import InjectBusWidgetAfterTable from '@/components/blog/InjectBusWidgetAfterTable';
import PostTransitWidget from '@/components/blog/PostTransitWidget';
import ArticleToc from '@/components/blog/ArticleToc';
import { buildArticleContent } from '@/lib/articleToc';
import StructuredData from '@/components/seo/StructuredData';
import { buildArticleEntitySchema } from '@/lib/entitySchema';
import { isLegacyContentPath } from '@/lib/legacyContentPaths';
import { formatTrDateTime } from '@/lib/dateTime';
import { resolveRootPostRoute } from '@/lib/postRoute';
import { rankInternalLinks } from '@/lib/internalLinking';
import SemanticInternalLinks from '@/components/blog/SemanticInternalLinks';
import AnswerSummary from '@/components/blog/AnswerSummary';
import { extractAnswerSummary } from '@/lib/answerSummary';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

type PageProps = {
  params: Promise<{ mainCategory: string; category: string }>;
};

/* ─────────────────────── Metadata ─────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mainCategory, category: categorySlug } = await params;
  if (isLegacyContentPath(`/${mainCategory}`)) notFound();

  // try both: the slug may refer to a sub-category OR a post
  const [cat, post, allCategories] = await Promise.all([
    fetchCategoryBySlug(categorySlug),
    fetchPostBySlug(categorySlug),
    fetchCategories(),
  ]);

  // 1) Sub-category page metadata
  if (cat) {
    const mainCat = allCategories.find((category) => category.slug === mainCategory);
    if (!mainCat || cat.parentId !== mainCat.id) {
      notFound();
    }

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
    const route = resolveRootPostRoute({
      mainCategorySlug: mainCategory,
      postSlug: post.slug,
      postCategoryIds: post.categoryIds,
      categories: allCategories,
    });
    if (!route) notFound();

    const title = post.title;
    const description = post.excerpt || post.title;
    const canonical = `${SITE_URL}${route.pathname}`;
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
  if (isLegacyContentPath(`/${mainCategorySlug}`)) notFound();

  // Parallel fetch: category, post, allCategories
  const [category, post, allCategories] = await Promise.all([
    fetchCategoryBySlug(categorySlug),
    fetchPostBySlug(categorySlug),
    fetchCategories(),
  ]);

  const mainCategory = allCategories.find((c) => c.slug === mainCategorySlug) || null;

  if (category && (!mainCategory || category.parentId !== mainCategory.id)) {
    notFound();
  }

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
        <StructuredData
          id={`schema-collection-${category.slug}`}
          data={{
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
          }}
        />
        {/* JSON-LD: BreadcrumbList */}
        <StructuredData
          id={`schema-breadcrumb-${category.slug}`}
          data={{
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
    const route = resolveRootPostRoute({
      mainCategorySlug,
      postSlug: post.slug,
      postCategoryIds: post.categoryIds,
      categories: allCategories,
    });
    if (!route) notFound();

    const postCategory = route.category;
    const postMainCategory = route.category;
    const postCanonicalUrl = `${SITE_URL}${route.pathname}`;

    const internalLinkCandidates = await fetchInternalLinkCandidates({
      categoryIds: [postMainCategory.id],
    });
    const internalLinks = rankInternalLinks({
      currentPost: post,
      candidates: internalLinkCandidates,
      categories: allCategories,
      preferredRootCategoryId: postMainCategory.id,
    });

    const { summaryHtml, contentHtml } = extractAnswerSummary(post.content, post.excerpt);
    const { html: renderedContent, headings } = buildArticleContent(contentHtml);

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
            { label: post.title },
          ]}
        />

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

        <h1 className="text-2xl font-bold mb-4 text-brand-soft-blue">{post.title}</h1>

        <AnswerSummary html={summaryHtml} />

        <PostTransitWidget postTitle={post.title} />

        <div className="text-xs text-gray-500 mb-4">
          <span>{formatTrDateTime(post.publishedAt)}</span>
        </div>

        <ArticleToc headings={headings} />

        <article className="post-detail space-y-6">
          {post.location && renderedContent.includes('[map]') ? (
            renderedContent.split('[map]').map((part, idx, arr) => (
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
            <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
          )}
        </article>

        <InjectBusWidgetAfterTable />

        {!renderedContent.includes('[map]') && post.location && (
          <PostLocationMap
            latitude={post.location.latitude}
            longitude={post.location.longitude}
            title={post.title}
          />
        )}

        <StructuredData
          id={`schema-article-${post.slug}`}
          data={buildArticleEntitySchema({
            post,
            category: postCategory || mainCategory,
            mainCategory: postMainCategory,
            canonicalUrl: postCanonicalUrl,
            siteUrl: SITE_URL,
          })}
        />

        {/* Yorumlar */}
        <PostComments postId={post.id} />

        <SemanticInternalLinks links={internalLinks} categories={allCategories} />
      </div>
    );
  }

  /* ────── Neither category nor post found ────── */
  notFound();
}
