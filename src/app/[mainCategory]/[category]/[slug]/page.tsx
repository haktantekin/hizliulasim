import Image from "next/image";
import Link from "next/link";
import { fetchPostBySlug, fetchCategories, fetchPosts } from "@/services/wordpress";
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

export default async function BlogPostPage({ params }: { params: Promise<{ mainCategory: string; category: string; slug: string }> }) {
  const { slug, category, mainCategory } = await params;
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
  
  // Related posts from the same category (by date desc)
  let relatedPosts: Awaited<ReturnType<typeof fetchPosts>> = [];
  if (post.categoryIds.length > 0) {
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

  const { html: renderedContent, headings } = buildArticleContent(post.content);

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4 text-brand-soft-blue">{post.title}</h1>

      <Breadcrumb
        className="mb-6"
        items={[
          ...(mainCat ? [{ label: mainCat.name, href: `/${mainCat.slug}` }] : []),
          ...(cat ? [{ label: cat.name, href: `/${mainCategory}/${cat.slug}` }] : []),
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
      <div className="text-xs text-gray-500 mb-4">
        <span>{new Date(post.publishedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <PostTransitWidget postTitle={post.title} />

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
          canonicalUrl,
          siteUrl: baseUrl,
        })}
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
                item: `${baseUrl}/`,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Kategoriler',
                item: `${baseUrl}/kategoriler`,
              },
              ...(mainCat
                ? [
                  {
                    '@type': 'ListItem',
                    position: 3,
                    name: mainCat.name,
                    item: `${baseUrl}/${mainCat.slug}`,
                  },
                ]
                : []),
              ...(cat
                ? [
                  {
                    '@type': 'ListItem',
                    position: 4,
                    name: cat.name,
                    item: `${baseUrl}/${mainCategory}/${cat.slug}`,
                  },
                ]
                : []),
            ],
          }),
        }}
      />
      {/* FAQ Schema */}
      {post.faq && post.faq.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
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
            }),
          }}
        />
      )}
      {/* Yorumlar */}
      <PostComments postId={post.id} />

      {relatedPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">İlgili İçerikler</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {relatedPosts.map((rp) => {
              const rpHref = `/${mainCategory}/${(cat?.slug || category)}/${rp.slug}`;
              const fallbackImage = getDummyImageForCategory(cat?.slug, rp.title);
              const imageUrl = rp.featuredImage?.url || fallbackImage?.url;
              const imageAlt = rp.featuredImage?.alt || fallbackImage?.alt || rp.title;

              return (
                <Link
                  key={rp.id}
                  href={rpHref}
                  className="min-w-[240px] max-w-[240px] snap-start rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow flex-shrink-0"
                >
                  <div className="relative w-full h-32 bg-gray-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={imageAlt}
                        fill
                        className="object-cover"
                        sizes="240px"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                        Görsel yok
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[2.6rem]">
                      {rp.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(rp.publishedAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ mainCategory: string; category: string; slug: string }> }): Promise<Metadata> {
  const { slug, category, mainCategory } = await params;
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
