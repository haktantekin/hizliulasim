import HomeCards from "@/components/home/homeCards";
import HomeBusFinder from "@/components/home/HomeBusFinder";
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
import LatestPostsRow from "../components/home/LatestPostsRow";
import HomeSearchBar from "../components/home/HomeSearchBar";
import TrafficIndex from "../components/home/TrafficIndex";
import Link from "next/link";
import { ParkingCircle, TrainFront } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto pb-4 px-4 pt-8 h-auto relative">
      <div className='text-gray-400 text-lg'>
        <span className='text-brand-orange font-bold text-xl'>Hızlı Ulaşım</span>&apos;a hoş geldiniz!
      </div>
      <HomeSearchBar />

      <Link
        href="/otopark-ucretleri"
        className="block mt-4 rounded-xl bg-gradient-to-r from-brand-soft-blue to-brand-dark-blue p-4 text-white hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <ParkingCircle className="w-8 h-8 flex-none" />
          <div>
            <div className="font-bold text-sm">İSPARK OTOPARK</div>
            <div className="text-xs text-white/80">Anlık doluluk bilgileri ve güncel ücret tarifeleri</div>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Link
          href="/rayli-sistemler"
          className="block rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 p-4 text-white hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <TrainFront className="w-7 h-7 flex-none" />
            <div>
              <div className="font-bold text-sm">Raylı Sistemler</div>
              <div className="text-[11px] text-white/80">Metro, tramvay, füniküler</div>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-4">
        <HomeBusFinder />
      </div>

      <div className="mt-4">
        <TrafficIndex />
      </div>

      <div className="mt-6">
        <LatestPostsRow />
      </div>
    </div>
  );
}
