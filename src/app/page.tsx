import HomeCards from "@/components/home/homeCards";
import type { Metadata } from 'next';
import { fetchPageSeoBySlug } from '@/services/wordpress';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchPageSeoBySlug('anasayfa');
  return {
    title: seo?.title,
    description: seo?.description,
    alternates: seo?.canonical ? { canonical: seo.canonical } : undefined,
    openGraph: seo?.ogImages ? { images: seo.ogImages.map(i => ({ url: i.url, width: i.width, height: i.height, alt: i.alt })) } : undefined,
    robots: seo?.robots ? { index: seo.robots.index, follow: seo.robots.follow } : undefined,
  };
}
import QuickLinks from "../components/home/QuickLinks";
import SearchBar from "../components/home/SearchBar";
import TopCafesCarousel from "../components/home/TopCafesCarousel";
import TopRestaurantsCarousel from "../components/home/TopRestaurantsCarousel";
import CategoryPostsGrid from "../components/home/CategoryPostsGrid";

export default function Home() {
  return (
    <div className="container mx-auto pb-4 px-4 pt-10 h-auto relative">
      <div className='text-gray-400 text-lg'>
        <span className='text-brand-soft-blue font-bold text-xl'>Hızlı Ulaşım</span>&apos;a hoş geldiniz!
      </div>
      <div className="w-full mt-3">
        <SearchBar />
      </div>
      <QuickLinks />
    <HomeCards/>
      <TopCafesCarousel />
      <TopRestaurantsCarousel />
  

      <div className="mt-12">
        <CategoryPostsGrid />
      </div>
    </div>
  );
}
