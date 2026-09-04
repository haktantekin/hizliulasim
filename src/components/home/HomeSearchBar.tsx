'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, X, Bus } from 'lucide-react';

import { BUS_SEARCH_CATEGORY_SLUG } from '@/lib/searchPage';

function normalizeSubmittedQuery(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export default function HomeSearchBar() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [busCode, setBusCode] = useState('');

  const onSubmitSearch = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const query = normalizeSubmittedQuery(searchTerm);
    if (query.length < 2) return;
    router.push(`/arama?q=${encodeURIComponent(query)}`);
  }, [router, searchTerm]);

  const onSubmitBusSearch = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const query = normalizeSubmittedQuery(busCode);
    if (query.length < 2) return;
    router.push(
      `/arama?q=${encodeURIComponent(query)}&kategori=${BUS_SEARCH_CATEGORY_SLUG}`,
    );
  }, [busCode, router]);

  return (
    <div className="w-full mt-3">
      <div className="flex flex-col md:flex-row gap-2">
        <form
          action="/arama"
          method="get"
          role="search"
          onSubmit={onSubmitSearch}
          className="relative flex-1"
        >
          <input
            type="search"
            name="q"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Sitede ara..."
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
            minLength={2}
            maxLength={100}
            required
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-10 top-1.5 h-9 w-9 rounded-full text-gray-400 flex items-center justify-center hover:text-gray-600"
              title="Temizle"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            aria-label="Sitede ara"
            className="absolute right-1.5 top-1 h-9 w-9 rounded-full text-gray-500 flex items-center justify-center hover:opacity-90"
          >
            <SearchIcon size={18} />
          </button>
        </form>

        <form
          action="/arama"
          method="get"
          role="search"
          onSubmit={onSubmitBusSearch}
          className="relative flex-1"
        >
          <input type="hidden" name="kategori" value={BUS_SEARCH_CATEGORY_SLUG} />
          <input
            type="search"
            name="q"
            value={busCode}
            onChange={(event) => setBusCode(event.target.value)}
            placeholder="Otobüs hattı ara (ör: 500T)"
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
            minLength={2}
            maxLength={100}
            required
          />
          <button
            type="submit"
            aria-label="Otobüs hattı ara"
            className="absolute right-1.5 top-1 h-9 w-9 rounded-full text-gray-500 flex items-center justify-center hover:opacity-90"
          >
            <Bus size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
