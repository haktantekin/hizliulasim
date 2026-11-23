'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, Baby, Clock3, ExternalLink, Loader2, LocateFixed, MapPin, Navigation, RefreshCw, Search, Toilet as ToiletIcon } from 'lucide-react';
import type { Toilet, ToiletEnvelope } from '@/lib/toilets/contracts';
import { decodeToiletEnvelope } from '@/lib/toilets/wire';
import { buildLocationOptions, locationKey } from '@/lib/toilets/locations';

const ToiletMap = dynamic(() => import('./ToiletMap'), {
  ssr: false,
  loading: () => <p role="status" className="grid h-full place-items-center rounded-xl bg-gray-100 text-sm text-gray-500">Harita yükleniyor…</p>,
});

type Position = { lat: number; lng: number };
type LocationState =
  | { status: 'idle' | 'loading' | 'denied' | 'error' }
  | { status: 'active'; position: Position };

const kindLabels: Record<Toilet['kind'], string> = {
  public: 'Umumi tuvalet',
  mosque: 'Cami / ibadethane',
  shopping: 'Alışveriş noktası',
  fuel: 'Benzin istasyonu',
  transport: 'Ulaşım noktası',
  park: 'Park / yeşil alan',
  other: 'Diğer',
};
const cardKindLabels = {
  ...kindLabels,
  mosque: 'Cami / ibadethane tuvaleti',
  shopping: 'AVM / alışveriş noktası tuvaleti',
  fuel: 'Benzin istasyonu tuvaleti',
};
const feeLabels: Record<Toilet['fee'], string> = {
  yes: 'Ücretli',
  no: 'Ücretsiz',
  unknown: 'Ücret bilgisi yok',
};
const sourceLabels = { ibb: 'İBB şehir tuvaletleri', osm: 'OpenStreetMap' } as const;
const collator = new Intl.Collator('tr');

function distanceMeters(from: Position, to: Position): number {
  const radians = Math.PI / 180;
  const latitude = (to.lat - from.lat) * radians;
  const longitude = (to.lng - from.lng) * radians;
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(longitude / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} km`;
}

function formatDate(value: string | null): string {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(timestamp)
    : 'Tarih belirtilmemiş';
}

export default function ToiletsClient() {
  const [data, setData] = useState<ToiletEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [kind, setKind] = useState('');
  const [fee, setFee] = useState('');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [location, setLocation] = useState<LocationState>({ status: 'idle' });
  const [showCount, setShowCount] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const position = location.status === 'active' ? location.position : null;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch('/api/toilets', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Tuvalet verileri alınamadı.');
        const result = decodeToiletEnvelope(await response.json());
        if (!controller.signal.aborted) setData(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ status: 'error' });
      return;
    }
    setLocation({ status: 'loading' });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ status: 'active', position: { lat: coords.latitude, lng: coords.longitude } });
        setShowCount(50);
      },
      (failure) => setLocation({ status: failure.code === failure.PERMISSION_DENIED ? 'denied' : 'error' }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const cities = useMemo(() => buildLocationOptions((data?.toilets ?? []).map((toilet) => toilet.city)), [data]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    return (data?.toilets ?? []).filter((toilet) => {
      if (city && locationKey(toilet.city) !== city) return false;
      if (kind && toilet.kind !== kind) return false;
      if (fee && toilet.fee !== fee) return false;
      if (accessibleOnly && toilet.wheelchair !== 'yes') return false;
      return !query || [toilet.name, toilet.city, toilet.district].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(query);
    }).map((toilet) => ({ toilet, distance: position ? distanceMeters(position, toilet) : null }))
      .sort((a, b) => position
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity) || collator.compare(a.toilet.name, b.toilet.name)
        : collator.compare(a.toilet.city ?? '', b.toilet.city ?? '') || collator.compare(a.toilet.name, b.toilet.name));
  }, [data, search, city, kind, fee, accessibleOnly, position]);
  const visible = filtered.slice(0, showCount);
  const mapToilets = useMemo(() => filtered.slice(0, showCount).map(({ toilet }) => toilet), [filtered, showCount]);

  function resetVisible() {
    setShowCount(50);
    setSelectedId(null);
  }

  if (loading && !data) {
    return <div role="status" className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500"><Loader2 aria-hidden className="size-5 animate-spin" /> Tuvalet noktaları yükleniyor…</div>;
  }
  if (error && !data) {
    return (
      <div role="alert" className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-700">Tuvalet noktaları şu anda yüklenemedi.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-soft-blue"><RefreshCw aria-hidden className="size-4" /> Tekrar dene</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand-dark-blue">Size yakın tuvaletleri bulun</p>
            <p className="mt-1 text-xs text-gray-600">Konumunuzu paylaştığınızda mesafeye göre sıralanır. Konumunuz bu sayfada kullanılır, sunucuya gönderilmez.</p>
          </div>
          <button type="button" onClick={requestLocation} disabled={location.status === 'loading'} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-soft-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark-blue disabled:opacity-60">
            {location.status === 'loading' ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <LocateFixed aria-hidden className="size-4" />}
            {location.status === 'loading' ? 'Konum alınıyor…' : position ? 'Konumumu yenile' : 'Yakınımdakileri göster'}
          </button>
        </div>
        <div aria-live="polite">
          {location.status === 'denied' && <p className="mt-2 text-xs text-gray-600">Konum izni verilmedi. Tarayıcınızın site izinlerinden konumu açabilir veya şehir seçerek arayabilirsiniz.</p>}
          {location.status === 'error' && <p className="mt-2 text-xs text-gray-600">Konum alınamadı. Tekrar deneyebilir veya şehir seçerek arayabilirsiniz.</p>}
          {position && <p className="mt-2 text-xs text-brand-dark-blue">En yakın noktalar önce gösteriliyor. Mesafeler kuş uçuşudur.</p>}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-medium text-gray-600">
          Yer veya ilçe ara
          <span className="relative mt-1 block">
            <Search aria-hidden className="absolute left-3 top-3 size-4 text-gray-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); resetVisible(); }} placeholder="Cami, AVM, benzin istasyonu, ilçe…" type="search" className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40" />
          </span>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Şehir / yerleşim
          <select value={city} onChange={(event) => { setCity(event.target.value); resetVisible(); }} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40">
            <option value="">Tüm şehir ve yerleşimler</option>
            {cities.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Yer türü
          <select value={kind} onChange={(event) => { setKind(event.target.value); resetVisible(); }} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40">
            <option value="">Tüm yerler</option>
            {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-600">
          Ücret
          <select value={fee} onChange={(event) => { setFee(event.target.value); resetVisible(); }} className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/40">
            <option value="">Ücret fark etmez</option>
            {Object.entries(feeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={accessibleOnly} onChange={(event) => { setAccessibleOnly(event.target.checked); resetVisible(); }} className="size-4 accent-brand-soft-blue" />
        Tekerlekli sandalye erişimi var olarak kayıtlı noktalar
      </label>
      <p className="mb-4 text-xs leading-5 text-gray-500">Ücret ve çalışma saatleri her noktada belirtilmemiş olabilir. Kayıtlı saatler, şu anda açık olduğu anlamına gelmez.</p>
      <p className="mb-4 text-xs leading-5 text-gray-500">AVM, cami ve benzin istasyonu noktaları mekânın girişini veya merkezini gösterebilir; tuvalet kullanımı mekânın çalışma saatlerine ve giriş koşullarına bağlıdır.</p>

      {data && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
          {(['ibb', 'osm'] as const).map((key) => {
            const source = data.sources[key];
            return (
              <p key={key}>
                <span className="font-medium text-gray-700">{sourceLabels[key]}</span>
                {' · '}{source.count.toLocaleString('tr-TR')} kayıt{' · '}{formatDate(source.updatedAt)}
                {source.status === 'stale' && ' · Son alınan kayıtlar gösteriliyor.'}
                {source.status === 'unavailable' && ' · Bu kaynaktan şu anda veri alınamıyor.'}
              </p>
            );
          })}
          {error && <p className="mt-1">Bilgiler yenilenemedi; son yüklenen noktalar gösteriliyor.</p>}
        </div>
      )}

      <div aria-live="polite" className="mb-3 text-xs text-gray-600">
        {filtered.length.toLocaleString('tr-TR')} tuvalet noktası bulundu{filtered.length > visible.length ? ` · Listede ve haritada ilk ${visible.length} nokta gösteriliyor` : ''}
      </div>
      {filtered.length > 0 ? (
        <>
          <div ref={mapContainerRef} className="mb-4 h-72 min-w-0 scroll-mt-24 sm:h-96"><ToiletMap toilets={mapToilets} position={position} selectedId={selectedId} onSelect={setSelectedId} /></div>
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map(({ toilet, distance }) => (
              <article key={toilet.id} className={`min-w-0 rounded-xl border bg-white p-4 transition-colors ${selectedId === toilet.id ? 'border-brand-soft-blue ring-1 ring-brand-soft-blue' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="flex min-w-0 items-start gap-2 text-sm font-semibold text-gray-900"><ToiletIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-soft-blue" /><span className="break-words">{toilet.name}</span></h2>
                  {distance !== null && <span className="shrink-0 text-right text-xs text-gray-600">{formatDistance(distance)}<span className="block text-[10px] text-gray-500">kuş uçuşu</span></span>}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{[toilet.district, toilet.city].filter(Boolean).join(' / ') || 'İlçe bilgisi belirtilmemiş'} · {cardKindLabels[toilet.kind]}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <span className={`rounded-full px-2 py-0.5 ${toilet.fee === 'no' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{feeLabels[toilet.fee]}</span>
                  {toilet.access === 'customers' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Yalnızca müşterilere</span>}
                  {toilet.access === 'permissive' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">İşletmenin iznine bağlı</span>}
                  {toilet.status === 'seasonal' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Dönemlik hizmet</span>}
                  {toilet.wheelchair !== 'unknown' && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-800"><Accessibility aria-hidden className="size-3" />{toilet.wheelchair === 'yes' ? 'Tekerlekli sandalye erişimi var' : toilet.wheelchair === 'limited' ? 'Sınırlı erişim' : 'Tekerlekli sandalye erişimi yok'}</span>}
                  {toilet.changingTable === 'yes' && <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-purple-700"><Baby aria-hidden className="size-3" />Alt değiştirme alanı</span>}
                </div>
                {toilet.openingHours && <p className="mt-2 flex items-start gap-1.5 break-words text-xs text-gray-600"><Clock3 aria-hidden className="mt-0.5 size-3.5 shrink-0" /><span>Kayıtlı çalışma saatleri: {toilet.openingHours}</span></p>}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-brand-soft-blue">
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline"><Navigation aria-hidden className="size-3.5" /> Yol tarifi</a>
                  <button type="button" onClick={() => { setSelectedId(toilet.id); mapContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} aria-pressed={selectedId === toilet.id} className="inline-flex items-center gap-1 hover:underline"><MapPin aria-hidden className="size-3.5" /> Haritada göster</button>
                  <a href={toilet.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-gray-500 hover:underline">{toilet.source === 'ibb' ? 'İBB' : 'OpenStreetMap'}<ExternalLink aria-hidden className="size-3" /></a>
                </div>
              </article>
            ))}
          </div>
          {visible.length < filtered.length && <button type="button" onClick={() => setShowCount((value) => value + 50)} className="mt-4 w-full rounded-xl border border-brand-soft-blue py-3 text-sm font-medium text-brand-soft-blue transition-colors hover:bg-blue-50">Daha fazla göster ({(filtered.length - visible.length).toLocaleString('tr-TR')} kaldı)</button>}
        </>
      ) : (
        <div role="status" className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">Bu aramaya uygun kayıtlı tuvalet bulunamadı. Filtreleri genişleterek tekrar deneyin.</div>
      )}
    </div>
  );
}
