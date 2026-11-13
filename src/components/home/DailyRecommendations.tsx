'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeTurkishLira,
  ChevronRight,
  CircleDollarSign,
  LocateFixed,
  MapPinned,
  Navigation,
  Sparkles,
} from 'lucide-react';

import { formatTrDateTime } from '@/lib/dateTime';
import type { DailyRecommendationsResponse, RecommendationSlot } from '@/lib/recommendations/contracts';
import { buildTransitPlannerDestinationUrl } from '@/lib/transit/share-url';
import type { DailyRecommendationsStatus } from './daily-recommendations-state';

const slotPresentation: Record<RecommendationSlot, { label: string; icon: typeof Sparkles }> = {
  best: { label: 'Bugünün seçimi', icon: Sparkles },
  nearby: { label: 'Yakınında', icon: MapPinned },
  free: { label: 'Ücretsiz', icon: CircleDollarSign },
};
const recommendationSlots: RecommendationSlot[] = ['best', 'nearby', 'free'];

function canRenderWithNextImage(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'cms.hizliulasim.com';
  } catch {
    return false;
  }
}

export default function DailyRecommendations({
  data,
  status,
  notice,
  onLocate,
}: {
  data: DailyRecommendationsResponse | null;
  status: DailyRecommendationsStatus;
  notice: string | null;
  onLocate: () => void;
}) {
  const refreshing = status === 'refreshing';
  const cards = data?.cards ?? [];
  const cardsBySlot = new Map(cards.map((card) => [card.slot, card]));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-brand-soft-blue">Bugün nereye gidebilirim?</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {data?.context.locationApplied ? 'Konumuna ve bugünün koşullarına göre' : 'İstanbul geneli, bugünün koşullarına göre'}
          </p>
        </div>
        <button
          type="button"
          onClick={onLocate}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-brand-light-blue bg-white px-3 py-2 text-xs font-semibold text-brand-soft-blue transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-brand-orange disabled:cursor-wait disabled:opacity-60"
        >
          <LocateFixed aria-hidden className={`h-4 w-4 ${refreshing ? 'animate-pulse' : ''}`} />
          {refreshing ? 'Konuma göre yenileniyor' : 'Konumuma göre öner'}
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {recommendationSlots.map((slot) => {
            const card = cardsBySlot.get(slot);
            const { label, icon: SlotIcon } = slotPresentation[slot];
            if (!card) {
              return (
                <article key={slot} className="min-h-[360px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                  <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 text-brand-soft-blue/35">
                    <MapPinned aria-hidden className="h-10 w-10" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-soft-blue shadow-sm">
                      <SlotIcon aria-hidden className="h-3.5 w-3.5 text-brand-orange" />
                      {label}
                    </span>
                  </div>
                  <div className="flex min-h-[228px] flex-col items-center justify-center p-4 text-center">
                    <p className="text-sm font-semibold text-gray-500">Bu başlıkta bugün için uygun öneri bulunamadı.</p>
                  </div>
                </article>
              );
            }
            const plannerHref = card.candidate.location
              ? buildTransitPlannerDestinationUrl({ name: card.candidate.title, ...card.candidate.location })
              : null;
            const showImage = Boolean(card.candidate.image && canRenderWithNextImage(card.candidate.image.url));

            return (
              <article key={`${card.slot}-${card.candidate.id}`} className="min-h-[360px] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="relative h-32 bg-gradient-to-br from-blue-50 to-orange-50">
                  {showImage && card.candidate.image ? (
                    <Image
                      src={card.candidate.image.url}
                      alt={card.candidate.image.alt || card.candidate.title}
                      fill
                      className="object-cover"
                      sizes="(min-width: 768px) 33vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-brand-soft-blue/35">
                      <MapPinned aria-hidden className="h-10 w-10" />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-soft-blue shadow-sm">
                    <SlotIcon aria-hidden className="h-3.5 w-3.5 text-brand-orange" />
                    {label}
                  </span>
                </div>

                <div className="p-4">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-brand-soft-blue">
                      {card.candidate.category.name}
                    </span>
                    {card.candidate.profile.budget === 'free' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        <BadgeTurkishLira aria-hidden className="h-3 w-3" /> Ücretsiz
                      </span>
                    )}
                    {card.editorial && (
                      <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-brand-orange">Editör seçimi</span>
                    )}
                  </div>
                  <h4 className="line-clamp-2 min-h-[2.75rem] text-base font-bold leading-snug text-gray-900">
                    {card.candidate.title}
                  </h4>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-gray-600">{card.reason}</p>
                  {(card.distanceKm !== undefined || card.candidate.profile.district) && (
                    <p className="mt-2 text-[11px] text-gray-400">
                      {card.distanceKm !== undefined ? `Yaklaşık ${card.distanceKm} km` : card.candidate.profile.district}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={card.candidate.href}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-dark-blue px-3 py-2 text-xs font-semibold text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-orange"
                    >
                      İncele <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                    </Link>
                    {plannerHref && (
                      <Link
                        href={plannerHref}
                        className="inline-flex min-h-9 items-center gap-1 rounded-full bg-orange-50 px-3 py-2 text-xs font-semibold text-brand-orange hover:bg-orange-100 focus-visible:ring-2 focus-visible:ring-brand-orange"
                      >
                        <Navigation aria-hidden className="h-3.5 w-3.5" /> Yol Tarifi
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>

      {data?.freshness.cms && cards.length > 0 && (
        <p className="mt-3 text-right text-[10px] text-gray-400">İçerikler {formatTrDateTime(data.freshness.cms)} tarihinde güncellendi.</p>
      )}
    </div>
  );
}
