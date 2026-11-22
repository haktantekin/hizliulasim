import type { Metadata } from 'next';
import { ExternalLink, Info } from 'lucide-react';

import Breadcrumb from '@/components/ui/Breadcrumb';
import { DATA_SOURCES } from '@/lib/dataSources';

export const metadata: Metadata = {
  title: 'Veri Kaynakları ve Bağımsızlık Bildirimi',
  description:
    'Hızlı Ulaşım uygulamasında kullanılan resmî ulaşım verileri, harita sağlayıcıları ve bağımsızlık bildirimi.',
  alternates: { canonical: 'https://hizliulasim.com/veri-kaynaklari' },
};

const entries = Object.entries(DATA_SOURCES);

function SourceList({ official }: { official: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries
        .filter(([, source]) => source.official === official)
        .map(([key, source]) => (
          <a
            key={key}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-light-blue hover:shadow-sm"
          >
            <span className="flex items-center gap-2 font-semibold text-brand-dark-blue">
              {source.name}
              <ExternalLink aria-hidden="true" className="size-4 text-gray-400 group-hover:text-brand-soft-blue" />
            </span>
            <span className="mt-1 block text-xs font-medium text-brand-soft-blue">{source.displayUrl}</span>
            <span className="mt-2 block text-sm leading-6 text-gray-600">{source.description}</span>
          </a>
        ))}
    </div>
  );
}

export default function VeriKaynaklariPage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-dark-blue">Veri Kaynakları</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
        Hızlı Ulaşım, farklı ulaşım ve harita sağlayıcılarının yayımladığı verileri tek arayüzde
        anlaşılır biçimde sunan bağımsız bir rehberdir.
      </p>

      <Breadcrumb className="my-5" items={[{ label: 'Veri Kaynakları' }]} />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <div className="flex items-start gap-3">
          <Info aria-hidden="true" className="mt-1 size-5 shrink-0" />
          <div>
            <h2 className="font-bold">Bağımsızlık ve güncellik bildirimi</h2>
            <p className="mt-1">
              Hızlı Ulaşım; İstanbul Büyükşehir Belediyesi, İETT, Metro İstanbul, İSPARK veya
              başka bir kamu kurumunun resmî uygulaması değildir ve bu kurumları temsil etmez.
              Veriler bilgilendirme amaçlıdır; sefer, güzergâh, doluluk ve ücret bilgileri kaynak
              kuruluşlar tarafından değiştirilebilir. Yolculuk öncesinde bağlantılı resmî kaynağı
              kontrol etmenizi öneririz.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="official-sources" className="mt-8">
        <h2 id="official-sources" className="mb-3 text-xl font-bold text-gray-900">Resmî kaynaklar</h2>
        <SourceList official />
      </section>

      <section aria-labelledby="other-sources" className="mt-8">
        <h2 id="other-sources" className="mb-3 text-xl font-bold text-gray-900">Diğer veri ve harita sağlayıcıları</h2>
        <p className="mb-3 text-sm text-gray-600">
          Aşağıdaki hizmetler kamu kurumu değildir; harita, yer arama veya topluluk verisi sağlar.
        </p>
        <SourceList official={false} />
      </section>
    </main>
  );
}

