import { fetchCategoryBySlug, fetchCategories, fetchPosts } from '@/services/wordpress';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MainCategoryClient from './MainCategoryClient';
import Script from 'next/script';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export async function generateMetadata(
  { params }: { params: Promise<{ mainCategory: string }> },
): Promise<Metadata> {
  const { mainCategory } = await params;
  const category = await fetchCategoryBySlug(mainCategory);

  if (!category) {
    return {
      title: 'Kategori Bulunamadı',
      robots: { index: false, follow: false },
    };
  }

  const description = category.description || `${category.name} kategorisindeki tüm blog yazıları ve içerikler.`;

  return {
    title: category.name,
    description,
    alternates: { canonical: `${SITE_URL}/${category.slug}` },
    openGraph: {
      title: `${category.name} | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/${category.slug}`,
      type: 'website',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
    },
    twitter: {
      card: 'summary',
      title: `${category.name} | Hızlı Ulaşım`,
      description,
    },
  };
}

export default async function MainCategoryPage(
  { params }: { params: Promise<{ mainCategory: string }> },
) {
  const { mainCategory } = await params;

  const category = await fetchCategoryBySlug(mainCategory);
  if (!category) notFound();

  const [allCategories, initialPosts] = await Promise.all([
    fetchCategories(),
    fetchPosts({ categoryId: category.id, per_page: 20, orderby: 'date', order: 'desc' }),
  ]);

  const subCategories = allCategories.filter(c => c.parentId === category.id);

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
            description: category.description || `${category.name} kategorisindeki yazılar`,
            url: `${SITE_URL}/${category.slug}`,
            isPartOf: { '@type': 'WebSite', name: 'Hızlı Ulaşım', url: SITE_URL },
            ...(initialPosts.length > 0 && {
              mainEntity: {
                '@type': 'ItemList',
                numberOfItems: initialPosts.length,
                itemListElement: initialPosts.slice(0, 10).map((post, i) => ({
                  '@type': 'ListItem',
                  position: i + 1,
                  url: (() => {
                    const catId = post.categoryIds?.[0];
                    const cat = catId ? allCategories.find(c => c.id === catId) : null;
                    const parent = cat?.parentId ? allCategories.find(c => c.id === cat.parentId) : null;
                    if (parent && cat) return `${SITE_URL}/${parent.slug}/${cat.slug}/${post.slug}`;
                    if (cat) return `${SITE_URL}/${cat.slug}/${post.slug}`;
                    return `${SITE_URL}/${category.slug}/${post.slug}`;
                  })(),
                  name: post.title,
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
              { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Kategoriler', item: `${SITE_URL}/kategoriler` },
              { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/${category.slug}` },
            ],
          }),
        }}
      />
      <MainCategoryClient
        category={category}
        allCategories={allCategories}
        subCategories={subCategories}
        initialPosts={initialPosts}
      />
    </>
  );
}
