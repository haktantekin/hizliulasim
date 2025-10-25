import { fetchCategories, fetchPosts } from "@/services/wordpress";
import BlogPageClient from "@/app/blog/BlogPageClient";

export default async function BlogPage() {
  const categories = await fetchCategories();
  const initialPosts = await fetchPosts({ per_page: 12, page: 1, orderby: 'date', order: 'desc' });
  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold text-brand-soft-blue">Blog</h1>
      {/* JSON-LD: CollectionPage and BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Blog',
            url: '/blog',
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
              { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: '/' },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: '/blog' },
            ],
          }),
        }}
      />
      <BlogPageClient categories={categories} initialPosts={initialPosts} />
    </div>
  );
}