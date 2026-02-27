import { fetchCategoryBySlug, fetchCategories, fetchPosts } from '@/services/wordpress';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MainCategoryClient from '../[mainCategory]/MainCategoryClient';
import Script from 'next/script';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
const DEFAULT_IMAGE = 'https://cms.hizliulasim.com/wp-content/uploads/2026/02/otobus-hatlari.jpeg';
const CATEGORY_SLUG = 'otobus-hatlari';

export async function generateMetadata(): Promise<Metadata> {
  const category = await fetchCategoryBySlug(CATEGORY_SLUG);

  if (!category) {
    return {
      title: 'Otobüs Hatları | Hızlı Ulaşım',
      description: 'İstanbul İETT otobüs hatları, güzergahları ve sefer saatleri.',
    };
  }

  const description = category.description || 'İstanbul İETT otobüs hatları, güzergahları, sefer saatleri ve canlı araç konumları.';

  return {
    title: category.name,
    description,
    alternates: { canonical: `${SITE_URL}/${CATEGORY_SLUG}` },
    openGraph: {
      title: `${category.name} | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/${CATEGORY_SLUG}`,
      type: 'website',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
      images: [{ url: DEFAULT_IMAGE, width: 1200, height: 630, alt: 'İETT Otobüs Hatları' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} | Hızlı Ulaşım`,
      description,
      images: [DEFAULT_IMAGE],
    },
  };
}

export default async function OtobusHatlariPage() {
  const category = await fetchCategoryBySlug(CATEGORY_SLUG);
  if (!category) notFound();

  const [allCategories, initialPosts] = await Promise.all([
    fetchCategories(),
    fetchPosts({ categoryId: category.id, per_page: 20, orderby: 'date', order: 'desc' }),
  ]);

  const subCategories = allCategories.filter(c => c.parentId === category.id);

  return (
    <>
      <Script
        id={`schema-collection-${category.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: category.name,
            description: category.description || `${category.name} kategorisindeki yazılar`,
            url: `${SITE_URL}/${CATEGORY_SLUG}`,
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
                    return `${SITE_URL}/${CATEGORY_SLUG}/${post.slug}`;
                  })(),
                  name: post.title,
                })),
              },
            }),
          }),
        }}
      />
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
              { '@type': 'ListItem', position: 3, name: category.name, item: `${SITE_URL}/${CATEGORY_SLUG}` },
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
