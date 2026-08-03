import Link from 'next/link';
import { ChevronDown, ListTree } from 'lucide-react';
import type { TocHeading } from '@/lib/articleToc';

interface ArticleTocProps {
  headings: TocHeading[];
}

export default function ArticleToc({ headings }: ArticleTocProps) {
  if (!headings.length) return null;

  return (
    <nav aria-label="İçindekiler" className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 text-brand-soft-blue transition-colors hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-light-blue/50">
            <ListTree className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex-1 text-sm font-semibold">İçindekiler</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            {headings.length} bölüm
          </span>
          <ChevronDown
            className="h-4 w-4 flex-none text-gray-400 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t border-gray-100 px-3 py-3">
          <ul className="space-y-0.5 border-l border-brand-light-blue ml-4">
            {headings.map((heading) => (
              <li key={heading.id}>
                <Link
                  href={`#${heading.id}`}
                  className="block border-l-2 border-transparent py-2 pr-3 text-sm leading-snug text-gray-600 transition-colors hover:border-brand-orange hover:bg-brand-light-blue/20 hover:text-brand-soft-blue"
                  style={{ paddingLeft: `${Math.max(0, heading.level - 2) * 0.75 + 1}rem` }}
                >
                  {heading.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </nav>
  );
}