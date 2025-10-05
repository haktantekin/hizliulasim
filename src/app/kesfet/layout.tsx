import type { Metadata } from 'next';
import { fetchPageSeoBySlug } from '@/services/wordpress';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchPageSeoBySlug('kesfet');
  return {
    title: seo?.title,
    description: seo?.description,
    alternates: seo?.canonical ? { canonical: seo.canonical } : undefined,
    openGraph: seo?.ogImages ? { images: seo.ogImages.map(i => ({ url: i.url, width: i.width, height: i.height, alt: i.alt })) } : undefined,
    robots: seo?.robots ? { index: seo.robots.index, follow: seo.robots.follow } : undefined,
  };
}

export default function KesfetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
