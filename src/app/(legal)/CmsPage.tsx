import type { Metadata } from 'next';
import { fetchPageSeoBySlug } from '@/services/wordpress';

export async function generateMetaForSlug(slug: string): Promise<Metadata> {
  const seo = await fetchPageSeoBySlug(slug);
  return {
    title: seo?.title,
    description: seo?.description,
    alternates: seo?.canonical ? { canonical: seo.canonical } : undefined,
    openGraph: seo?.ogImages ? { images: seo.ogImages.map(i => ({ url: i.url, width: i.width, height: i.height, alt: i.alt })) } : undefined,
    robots: seo?.robots ? { index: seo.robots.index, follow: seo.robots.follow } : undefined,
  };
}

async function fetchPageContent(slug: string): Promise<string | null> {
  const base = process.env.NEXT_PUBLIC_WP_API_URL || 'https://cms.hizliulasim.com/wp-json/wp/v2';
  const res = await fetch(`${base}/pages?slug=${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0]?.content?.rendered || null;
}

export default async function CmsPage({ slug, heading }: { slug: string; heading?: string }) {
  const html = await fetchPageContent(slug);
  return (
    <div className="container mx-auto pb-4 px-4 pt-6 prose max-w-none prose-h1:text-2xl prose-p:leading-relaxed">
      {heading ? <h1 className="mb-4">{heading}</h1> : null}
      {html ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-600 text-sm">İçerik yüklenemedi.</p>
      )}
    </div>
  );
}
