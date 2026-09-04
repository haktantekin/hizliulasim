import Image from "next/image";
import { fetchPostBySlug, fetchCategories, fetchInternalLinkCandidates } from "@/services/wordpress";
import type { Metadata } from "next";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { Fragment } from "react";
import PostLocationMap from "@/components/blog/PostLocationMap";
import FaqAccordion from "@/components/ui/FaqAccordion";
import { getDummyImageForCategory } from "@/lib/getDummyImage";
import PostComments from "@/components/blog/PostComments";
import InjectBusWidgetAfterTable from "@/components/blog/InjectBusWidgetAfterTable";
import PostTransitWidget from "@/components/blog/PostTransitWidget";
import ArticleToc from "@/components/blog/ArticleToc";
import { buildArticleContent } from "@/lib/articleToc";
import { notFound } from "next/navigation";
import StructuredData from "@/components/seo/StructuredData";
import { buildArticleEntitySchema } from "@/lib/entitySchema";
import { isLegacyContentPath } from "@/lib/legacyContentPaths";
import { formatTrDateTime } from "@/lib/dateTime";
import { rankInternalLinks } from "@/lib/internalLinking";
import SemanticInternalLinks from "@/components/blog/SemanticInternalLinks";
import AnswerSummary from "@/components/blog/AnswerSummary";
import { extractAnswerSummary } from "@/lib/answerSummary";

export default async function BlogPostPage({ params }: { params: Promise<{ mainCategory: string; category: string; slug: string }> }) {
  const { slug, category, mainCategory } = await params;
  if (isLegacyContentPath(`/${mainCategory}`)) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
  const canonicalUrl = `${baseUrl}/${mainCategory}/${category}/${slug}`;
  const [post, categories] = await Promise.all([
    fetchPostBySlug(slug),
    fetchCategories(),
  ]);
  const cat = categories.find((c) => c.slug === category) || null;
  const mainCat = categories.find((c) => c.slug === mainCategory) || null;

  if (
    !post
    || !cat
    || !mainCat
    || cat.parentId !== mainCat.id
    || !post.categoryIds.includes(cat.id)
  ) {
    notFound();
  }
  
  const internalLinkCandidates = await fetchInternalLinkCandidates({
    categoryIds: [cat.id, mainCat.id],
  });
  const internalLinks = rankInternalLinks({
    currentPost: post,
    candidates: internalLinkCandidates,
    categories,
    preferredRootCategoryId: mainCat.id,
  });

  const { summaryHtml, contentHtml } = extractAnswerSummary(post.content, post.excerpt);
  const { html: renderedContent, headings } = buildArticleContent(contentHtml);

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumb
        className="mb-6"
        items={[
          { label: 'Kategoriler', href: '/kategoriler' },
          ...(mainCat ? [{ label: mainCat.name, href: `/${mainCat.slug}` }] : []),
          ...(cat ? [{ label: cat.name, href: `/${mainCategory}/${cat.slug}` }] : []),
          { label: post.title },
        ]}
      />

      {post.featuredImage ? (
        <div className="relative w-full h-64 md:h-96 mb-6">
          <Image src={post.featuredImage.url} alt={post.featuredImage.alt} fill className="object-cover rounded-lg" priority sizes="100vw" />
        </div>
      ) : (() => {
        const dummyImage = getDummyImageForCategory(mainCat?.slug, post.title);
        return dummyImage ? (
          <div className="relative w-full h-64 md:h-96 mb-6">
            <Image src={dummyImage.url} alt={dummyImage.alt} fill className="object-cover rounded-lg" priority sizes="100vw" />
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

      {/* İçerikte [map] shortcode'u varsa, haritayı oraya göm */}
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

      {/* Shortcode kullanılmadıysa fallback olarak haritayı göster */}
      {!renderedContent.includes('[map]') && post.location && (
        <PostLocationMap
          latitude={post.location.latitude}
          longitude={post.location.longitude}
          title={post.title}
        />
      )}

      {/* FAQ Accordion */}
      {post.faq && post.faq.length > 0 && (
        <FaqAccordion items={post.faq} />
      )}

      <StructuredData
        id={`schema-article-${post.slug}`}
        data={buildArticleEntitySchema({
          post,
          category: cat,
          mainCategory: mainCat,
          canonicalUrl,
          siteUrl: baseUrl,
        })}
      />
      {/* FAQ Schema */}
      {post.faq && post.faq.length > 0 && (
        <StructuredData
          id={`schema-faq-${post.slug}`}
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: post.faq.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }}
        />
      )}
      {/* Yorumlar */}
      <PostComments postId={post.id} />

      <SemanticInternalLinks links={internalLinks} categories={categories} />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ mainCategory: string; category: string; slug: string }> }): Promise<Metadata> {
  const { slug, category, mainCategory } = await params;
  if (isLegacyContentPath(`/${mainCategory}`)) notFound();

  const [post, categories] = await Promise.all([
    fetchPostBySlug(slug),
    fetchCategories(),
  ]);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

  const cat = categories.find((item) => item.slug === category);
  const mainCat = categories.find((item) => item.slug === mainCategory);

  if (
    !post
    || !cat
    || !mainCat
    || cat.parentId !== mainCat.id
    || !post.categoryIds.includes(cat.id)
  ) {
    notFound();
  }

  const title = post.title;
  const description = post.excerpt || post.title;
  const canonical = `${baseUrl}/${mainCategory}/${category}/${post.slug}`;
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
