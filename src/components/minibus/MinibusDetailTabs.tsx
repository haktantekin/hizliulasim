'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type KeyboardEvent } from 'react';
import {
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  Clock3,
  MapPin,
  Route,
  Ruler,
  Timer,
} from 'lucide-react';

import type {
  MinibusLineDetails,
  MinibusRoutePoint,
  MinibusSchedule,
  MinibusStop,
} from '@/lib/minibusData';
import { buildMinibusDetailHeadings } from '@/lib/minibusDetailHeadings';
import type { MinibusFareTariff } from '@/lib/minibusFare';
import MinibusFareCalculator from './MinibusFareCalculator';

const MinibusRouteMap = dynamic(() => import('./MinibusRouteMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[340px] items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 md:h-[440px]">
      Harita yükleniyor…
    </div>
  ),
});

type TabKey = 'route' | 'schedule' | 'stops' | 'fare';
type DirectionKey = 'outbound' | 'return';
type DayKey = 'weekday' | 'weekend';

const TABS = [
  { key: 'route' as const, label: 'Güzergâh', icon: Route },
  { key: 'schedule' as const, label: 'Sefer Bilgileri', icon: Clock3 },
  { key: 'stops' as const, label: 'Duraklar', icon: MapPin },
  { key: 'fare' as const, label: 'Ücret Tarifesi', icon: Banknote },
];

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      {children}
    </div>
  );
}

function ScheduleTimes({ title, times }: { title: string; times: string[] }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4" aria-label={title}>
      <h3 className="flex items-center gap-2 font-semibold text-gray-900">
        <ArrowLeftRight className="h-4 w-4 text-brand-soft-blue" aria-hidden="true" />
        {title}
      </h3>
      {times.length > 0 ? (
        <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {times.map((time, index) => (
            <li key={`${title}-${time}-${index}`} className="rounded-lg bg-blue-50 px-2 py-2 text-center font-mono text-sm font-semibold text-brand-soft-blue">
              {time}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">Bu yön için saat bilgisi yayımlanmamış.</p>
      )}
    </section>
  );
}

export default function MinibusDetailTabs({
  lineName,
  details,
  outboundRoute,
  returnRoute,
  schedule,
  stops,
  stopsVerified,
  fareTariff,
  fareSourceUrl,
}: {
  lineName: string;
  details: MinibusLineDetails | null;
  outboundRoute: MinibusRoutePoint[];
  returnRoute: MinibusRoutePoint[];
  schedule: MinibusSchedule | null;
  stops: MinibusStop[];
  stopsVerified: boolean;
  fareTariff: MinibusFareTariff | null;
  fareSourceUrl: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('route');
  const [direction, setDirection] = useState<DirectionKey>(outboundRoute.length > 0 ? 'outbound' : 'return');
  const [day, setDay] = useState<DayKey>('weekday');
  const sectionHeadings = buildMinibusDetailHeadings(lineName);

  const directions = useMemo(() => [
    ...(outboundRoute.length > 0 ? [{ key: 'outbound' as const, label: 'Gidiş', points: outboundRoute, color: '#304269' }] : []),
    ...(returnRoute.length > 0 ? [{ key: 'return' as const, label: 'Dönüş', points: returnRoute, color: '#e87924' }] : []),
  ], [outboundRoute, returnRoute]);
  const selectedDirection = directions.find((item) => item.key === direction) ?? directions[0];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setActiveTab(nextTab.key);
    document.getElementById(`minibus-tab-${nextTab.key}`)?.focus();
  }

  return (
    <section aria-label="Minibüs hat detayları" className="mt-6">
      <div className="overflow-x-auto pb-1">
        <div role="tablist" aria-label="Minibüs hat bilgi bölümleri" className="flex min-w-max gap-1 rounded-xl bg-gray-100 p-1 sm:min-w-0">
          {TABS.map((tab, index) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`minibus-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`minibus-panel-${tab.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.key)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`flex min-w-[145px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                  selected
                    ? 'bg-white text-brand-soft-blue shadow-sm'
                    : 'text-gray-500 hover:bg-white/60 hover:text-gray-800'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`minibus-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`minibus-tab-${activeTab}`}
        tabIndex={0}
        className="mt-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft-blue/40"
      >
        {activeTab === 'route' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{sectionHeadings.route}</h2>

            {details && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 sm:col-span-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Güzergâh</span>
                  <strong className="mt-1 block text-sm text-gray-900">{details.routeName}</strong>
                </div>
                {details.lengthKm !== undefined && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <Ruler className="h-5 w-5 text-brand-soft-blue" aria-hidden="true" />
                    <div><span className="block text-xs text-gray-500">Hat uzunluğu</span><strong>{details.lengthKm} km</strong></div>
                  </div>
                )}
                {details.durationMinutes !== undefined && (
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                    <Timer className="h-5 w-5 text-brand-orange" aria-hidden="true" />
                    <div><span className="block text-xs text-gray-500">Tahmini toplam süre</span><strong>{details.durationMinutes} dakika</strong></div>
                  </div>
                )}
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
                  <MapPin className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                  <div><span className="block text-xs text-gray-500">Harita noktası</span><strong>{selectedDirection?.points.length ?? 0}</strong></div>
                </div>
              </div>
            )}

            {directions.length > 1 && (
              <div className="flex flex-wrap gap-2" aria-label="Güzergâh yönü">
                {directions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={selectedDirection?.key === item.key}
                    onClick={() => setDirection(item.key)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedDirection?.key === item.key
                        ? 'bg-brand-soft-blue text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {selectedDirection ? (
              <MinibusRouteMap
                points={selectedDirection.points}
                directionLabel={selectedDirection.label}
                color={selectedDirection.color}
              />
            ) : (
              <EmptyPanel>Bu hat için resmî güzergâh geometrisi şu anda alınamıyor.</EmptyPanel>
            )}
            <p className="text-xs text-gray-500">Harita rotası İBB verisidir; trafik ve işletme koşullarına göre değişebilir.</p>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{sectionHeadings.schedule}</h2>

            <div className="flex flex-wrap gap-2" aria-label="Sefer günü">
              {([
                ['weekday', 'Hafta içi'],
                ['weekend', 'Hafta sonu'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={day === key}
                  onClick={() => setDay(key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                    day === key ? 'bg-brand-soft-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {schedule ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <ScheduleTimes
                  title="Gidiş saatleri"
                  times={day === 'weekday' ? schedule.weekdayOutbound : schedule.weekendOutbound}
                />
                <ScheduleTimes
                  title="Dönüş saatleri"
                  times={day === 'weekday' ? schedule.weekdayReturn : schedule.weekendReturn}
                />
              </div>
            ) : (
              <EmptyPanel>Tam sefer çizelgesi resmî kaynaktan şu anda alınamıyor.</EmptyPanel>
            )}

            {details && (
              <div className="grid gap-3 sm:grid-cols-2">
                {details.weekday && (
                  <div className="rounded-xl bg-blue-50 p-4 text-sm text-gray-700">
                    <strong className="block text-gray-900">Hafta içi çalışma aralığı</strong>
                    {details.weekday.start}–{details.weekday.end}, yaklaşık {details.weekday.intervalMinutes} dakika arayla
                  </div>
                )}
                {details.weekend && (
                  <div className="rounded-xl bg-orange-50 p-4 text-sm text-gray-700">
                    <strong className="block text-gray-900">Hafta sonu çalışma aralığı</strong>
                    {details.weekend.start}–{details.weekend.end}, yaklaşık {details.weekend.intervalMinutes} dakika arayla
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">Sefer saatleri trafik ve işletme koşullarına göre değişebilir.</p>
          </div>
        )}

        {activeTab === 'stops' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{sectionHeadings.stops}</h2>

            <div>
              {stopsVerified ? (
                stops.length > 0 ? (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">Durak ve güzergâh noktaları</h3>
                        <p className="text-xs text-gray-500">İBB&apos;nin bu hat için verdiği sıralı durak/cadde listesi.</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-soft-blue">{stops.length} nokta</span>
                    </div>
                    <ol className="grid gap-2 md:grid-cols-2">
                      {stops.map((stop, index) => (
                        <li key={`${stop.id}-${stop.name}`} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft-blue text-xs font-bold text-white">{index + 1}</span>
                          <span className="text-sm font-medium text-gray-800">{stop.name}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <EmptyPanel>İBB bu hat için sıralı durak/cadde listesi yayımlamamış.</EmptyPanel>
                )
              ) : (
                <EmptyPanel>Durak listesi resmî kaynakta iki ardışık okumada doğrulanamadığı için gösterilmiyor.</EmptyPanel>
              )}
            </div>
          </div>
        )}

        {activeTab === 'fare' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{sectionHeadings.fare}</h2>

            {fareTariff ? (
              <MinibusFareCalculator tariff={fareTariff} sourceUrl={fareSourceUrl} embedded />
            ) : (
              <EmptyPanel>Bu hat kodu için İBB ücret tarifesinde doğrulanmış bir fiyat tablosu bulunamadı.</EmptyPanel>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
