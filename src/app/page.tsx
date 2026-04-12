import HomeCards from "@/components/home/homeCards";
import HomeBusFinder from "@/components/home/HomeBusFinder";
import NearbyStopBusesWidget from "@/components/home/NearbyStopBusesWidget";
import DistrictIsparkWidget from "@/components/home/DistrictIsparkWidget";
import TransitDirectionsWidget from "@/components/home/TransitDirectionsWidget";
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
import { ParkingCircle, TrainFront, Zap, Navigation, Accessibility, MapPin } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto pb-4 px-4 pt-8 h-auto relative">
      <div className='text-gray-400 text-lg'>
        <span className='text-brand-orange font-bold text-xl'>Hızlı Ulaşım</span>&apos;a hoş geldiniz!
      </div>
      <HomeSearchBar />

      <div className="grid grid-cols-2 gap-3 mt-4">
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

        <Link
          href="/otopark-ucretleri"
          className="block rounded-xl bg-gradient-to-r from-brand-soft-blue to-brand-dark-blue p-4 text-white hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <ParkingCircle className="w-8 h-8 flex-none" />
            <div>
              <div className="font-bold text-sm">İSPARK OTOPARK</div>
              <div className="text-xs text-white/80">Anlık doluluk bilgileri</div>
            </div>
          </div>
        </Link>

        <Link
          href="/sarj-istasyonlari"
          className="col-span-2 block rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 p-4 text-white hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <Zap className="w-7 h-7 flex-none" />
            <div>
              <div className="font-bold text-sm">Şarj İstasyonları</div>
              <div className="text-xs text-white/80">Yakınımdaki elektrikli araç şarj noktaları</div>
            </div>
          </div>
        </Link>

        <Link
          href="/yol-tarifi"
          className="col-span-2 block rounded-xl bg-gradient-to-r from-brand-orange to-orange-600 p-4 text-white hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <Navigation className="w-7 h-7 flex-none" />
            <div>
              <div className="font-bold text-sm">Yol Tarifi</div>
              <div className="text-xs text-white/80">Toplu taşıma ile nereye, nasıl giderim?</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Engelsiz Erişim */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <Link
          href="/engelsiz-erisim/engelsiz-mekanlar"
          className="block rounded-xl bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 p-3 text-blue-700 hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <MapPin className="w-6 h-6" />
            <div className="font-bold text-xs">Engelsiz Mekanlar</div>
          </div>
        </Link>
        <Link
          href="/engelsiz-erisim/engelsiz-otoparklar"
          className="block rounded-xl bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 p-3 text-purple-700 hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <ParkingCircle className="w-6 h-6" />
            <div className="font-bold text-xs">Engelsiz Otoparklar</div>
          </div>
        </Link>
        <Link
          href="/engelsiz-erisim/engelsiz-rota"
          className="block rounded-xl bg-gradient-to-b from-orange-50 to-orange-100 border border-orange-200 p-3 text-orange-700 hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <Accessibility className="w-6 h-6" />
            <div className="font-bold text-xs">Engelsiz Rota</div>
          </div>
        </Link>
      </div>

      <div className="mt-4">
        <TransitDirectionsWidget />
      </div>

      <div className="mt-4">
        <HomeBusFinder />
      </div>

      <div className="mt-4">
        <NearbyStopBusesWidget />
      </div>

      <div className="mt-4">
        <DistrictIsparkWidget />
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
