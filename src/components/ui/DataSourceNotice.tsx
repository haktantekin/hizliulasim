import Link from 'next/link';
import { ExternalLink, Info } from 'lucide-react';

import { DATA_SOURCES, type DataSourceKey } from '@/lib/dataSources';

type DataSourceNoticeProps = {
  sources: readonly DataSourceKey[];
  note?: string;
  className?: string;
};

export default function DataSourceNotice({ sources, note, className = '' }: DataSourceNoticeProps) {
  return (
    <aside
      aria-label="Veri kaynakları ve bağımsızlık bildirimi"
      className={`mt-6 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs leading-5 text-gray-700 ${className}`}
    >
      <div className="flex items-start gap-2">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-soft-blue" />
        <div className="min-w-0">
          <p className="font-semibold text-brand-dark-blue">Veri kaynakları</p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {sources.map((key) => {
              const source = DATA_SOURCES[key];
              return (
                <li key={key}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand-soft-blue underline decoration-blue-300 underline-offset-2 hover:text-brand-dark-blue"
                  >
                    {source.name} ({source.displayUrl})
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                </li>
              );
            })}
          </ul>
          {note && <p className="mt-1">{note}</p>}
          <p className="mt-1 text-gray-600">
            Hızlı Ulaşım bağımsız bir bilgilendirme hizmetidir; İBB, İETT, Metro İstanbul,
            İSPARK veya başka bir kamu kurumunu temsil etmez.
          </p>
          <Link
            href="/veri-kaynaklari"
            className="mt-1 inline-block font-medium text-brand-dark-blue underline underline-offset-2"
          >
            Tüm veri kaynakları ve kullanım açıklaması
          </Link>
        </div>
      </div>
    </aside>
  );
}

