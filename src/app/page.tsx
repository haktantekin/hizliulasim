import HomeBusFinder from "@/components/home/HomeBusFinder";
import NearbyStopBusesWidget from "@/components/home/NearbyStopBusesWidget";
import DistrictIsparkWidget from "@/components/home/DistrictIsparkWidget";
import TransitDirectionsWidget from "@/components/home/TransitDirectionsWidget";
import AvmPostsRow from "@/components/home/AvmPostsRow";
import HospitalPostsRow from "@/components/home/HospitalPostsRow";
import OfficialOfficesPostsRow from "@/components/home/OfficialOfficesPostsRow";
import MuseumPostsRow from "@/components/home/MuseumPostsRow";
import TransitStructuresPostsRow from "@/components/home/TransitStructuresPostsRow";
import IettLatestNews from "@/components/home/IettLatestNews";
import type { Metadata } from 'next';
import { fetchPageSeoBySlug } from '@/services/wordpress';
import StructuredData from '@/components/seo/StructuredData';
import { buildSiteEntitySchema } from '@/lib/entitySchema';
import { canonicalMetadata } from '@/lib/seoMetadata';

export async function generateMetadata(): Promise<Metadata> {
  const seo = await fetchPageSeoBySlug('anasayfa');
  return {
    ...canonicalMetadata('/'),
    title: seo?.title,
    description: seo?.description,
    openGraph: seo?.ogImages ? { images: seo.ogImages.map(i => ({ url: i.url, width: i.width, height: i.height, alt: i.alt })) } : undefined,
    robots: seo?.robots ? { index: seo.robots.index, follow: seo.robots.follow } : undefined,
  };
}
import LatestPostsRow from "../components/home/LatestPostsRow";
import SaatBilgileriRow from "../components/home/SaatBilgileriRow";
import HomeSearchBar from "../components/home/HomeSearchBar";
import HomeActionLinks from "../components/home/HomeActionLinks";
import TodayIstanbulPanel from "../components/home/TodayIstanbulPanel";
import TrafficIndex from "../components/home/TrafficIndex";
import Link from "next/link";
import { ParkingCircle, Accessibility, MapPin } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto pb-4 px-4 pt-8 h-auto relative">
      <StructuredData
        id="schema-site-entities"
        data={buildSiteEntitySchema(process.env.NEXT_PUBLIC_SITE_URL)}
      />
      <div className='text-gray-400 text-lg'>
        <span className='text-brand-orange font-bold text-xl'>Hızlı Ulaşım</span>&apos;a hoş geldiniz!
      </div>
      <HomeSearchBar />
      <TodayIstanbulPanel />

      <div className="mt-4">
        <HomeActionLinks group="guide" />
      </div>

      <div className="mt-6">
        <TransitStructuresPostsRow />
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

      <div className="mt-6">
        <AvmPostsRow />
      </div>

      <div className="mt-4">
        <HomeBusFinder />
      </div>

      <div className="mt-6">
        <HospitalPostsRow />
      </div>

      <div className="mt-4">
        <NearbyStopBusesWidget />
      </div>

      <div className="mt-6">
        <OfficialOfficesPostsRow />
      </div>

      <div className="mt-4">
        <DistrictIsparkWidget />
      </div>

      <div className="mt-6">
        <MuseumPostsRow />
      </div>

      <div className="mt-4">
        <TrafficIndex />
      </div>

      <div className="mt-6">
        <IettLatestNews />
      </div>

      <div className="mt-6">
        <LatestPostsRow />
      </div>

      <div className="mt-4">
        <HomeActionLinks group="services" />
      </div>

      <div className="mt-6">
        <SaatBilgileriRow />
      </div>
    </div>
  );
}
