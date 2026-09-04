import { fetchCategories, fetchPosts } from "@/services/wordpress";
import BlogPageClient from "@/app/BlogPageClient";
import StructuredData from '@/components/seo/StructuredData';

export { metadata } from './metadata';

export default async function KategorilerPage() {
  const categories = await fetchCategories();
  const initialPosts = await fetchPosts({ per_page: 12, page: 1, orderby: 'date', order: 'desc' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-brand-soft-blue">Kategoriler</h1>
      {/* JSON-LD: CollectionPage and BreadcrumbList */}
      <StructuredData
        id="schema-collection-categories"
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Kategoriler',
          url: `${baseUrl}/kategoriler`,
        }}
      />
      <StructuredData
        id="schema-breadcrumb-categories"
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: `${baseUrl}/` },
            { '@type': 'ListItem', position: 2, name: 'Kategoriler', item: `${baseUrl}/kategoriler` },
          ],
        }}
      />
      <BlogPageClient categories={categories} initialPosts={initialPosts} mainCategoriesOnly={true} />
    </div>
  );
}
