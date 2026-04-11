'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, X, Bus, Loader2 } from 'lucide-react';
import { fetchPosts, fetchCategories } from '@/services/wordpress';
import type { BlogPost, BlogCategory } from '@/types/WordPress';
import PostListItem from '@/components/blog/PostListItem';

export default function HomeSearchBar() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);
  const [searchSearched, setSearchSearched] = useState(false);
  const [allCategories, setAllCategories] = useState<BlogCategory[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ulasimCategoryIdRef = useRef<number | null>(null);

  const [busCode, setBusCode] = useState('');
  const [busLoading, setBusLoading] = useState(false);
  const [busResults, setBusResults] = useState<BlogPost[]>([]);
  const [busSearched, setBusSearched] = useState(false);
  const busSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busCategoryIdRef = useRef<number | null>(null);

  const fetchSearchResults = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setSearchSearched(false);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchSearched(true);
    setSearchLoading(true);
    try {
      if (ulasimCategoryIdRef.current === null) {
        const categories = await fetchCategories();
        setAllCategories(categories);
        const ulasimRehberi = categories.find(c => c.slug === 'ulasim-rehberi');
        ulasimCategoryIdRef.current = ulasimRehberi?.id ?? 0;
      }

      const data = await fetchPosts({
        ...(ulasimCategoryIdRef.current ? { categoryId: ulasimCategoryIdRef.current } : {}),
        search: q,
        per_page: 10,
        page: 1,
      });
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [allCategories]);

  // Debounced live search for ulaşım rehberi
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    const q = searchTerm.trim();
    if (!q) {
      setSearchSearched(false);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    searchTimer.current = setTimeout(() => {
      void fetchSearchResults(q);
    }, 300);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchTerm, fetchSearchResults]);

  const onSubmitSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    void fetchSearchResults(searchTerm.trim());
  }, [searchTerm, fetchSearchResults]);

  const clearSearch = useCallback(() => {
    setSearchSearched(false);
    setSearchResults([]);
    setSearchTerm('');
  }, []);

  const goToSearchPost = useCallback((post: BlogPost) => {
    setSearchSearched(false);
    setSearchResults([]);
    setSearchTerm('');
    router.push(buildPostHref(post));
  }, [router]);

  function buildPostHref(post: BlogPost): string {
    const postCategoryId = post.categoryIds?.[0];
    const postCategory = postCategoryId ? allCategories.find(c => c.id === postCategoryId) : null;
    const parentCategory = postCategory?.parentId
      ? allCategories.find(c => c.id === postCategory.parentId)
      : null;
    if (parentCategory && postCategory?.parentId) {
      return `/${parentCategory.slug}/${postCategory.slug}/${post.slug}`;
    }
    if (postCategory && !postCategory.parentId) {
      return `/${postCategory.slug}/${post.slug}`;
    }
    return `/ulasim-rehberi/${post.slug}`;
  }

  const fetchBusResults = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setBusSearched(false);
      setBusResults([]);
      setBusLoading(false);
      return;
    }

    setBusSearched(true);
    setBusLoading(true);
    try {
      // Lazily resolve otobus-hatlari category id once
      if (busCategoryIdRef.current === null) {
        const cats = allCategories.length > 0 ? allCategories : await fetchCategories();
        if (allCategories.length === 0) setAllCategories(cats);
        const root = cats.find((c) => c.slug === 'otobus-hatlari');
        busCategoryIdRef.current = root?.id ?? 0;
      }

      const data = await fetchPosts({
        search: q,
        per_page: 12,
        page: 1,
        ...(busCategoryIdRef.current ? { categoryId: busCategoryIdRef.current } : {}),
      });
      setBusResults(data ?? []);
    } catch {
      setBusResults([]);
    } finally {
      setBusLoading(false);
    }
  }, [allCategories]);

  // Debounced live search as user types
  useEffect(() => {
    if (busSearchTimer.current) clearTimeout(busSearchTimer.current);

    const q = busCode.trim();
    if (!q) {
      setBusSearched(false);
      setBusResults([]);
      setBusLoading(false);
      return;
    }

    busSearchTimer.current = setTimeout(() => {
      void fetchBusResults(q);
    }, 300);

    return () => {
      if (busSearchTimer.current) clearTimeout(busSearchTimer.current);
    };
  }, [busCode, fetchBusResults]);

  const onBusSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // just trigger immediately
    if (busSearchTimer.current) clearTimeout(busSearchTimer.current);
    void fetchBusResults(busCode.trim());
  }, [busCode, fetchBusResults]);

  const goToBusPost = useCallback((post: BlogPost) => {
    setBusSearched(false);
    setBusResults([]);
    setBusCode('');
    router.push(buildPostHref(post));
  }, [router]);

  return (
    <div className="w-full mt-3">
      <div className="flex flex-col md:flex-row gap-2">
        {/* Ulaşım Rehberi Arama */}
        <form onSubmit={onSubmitSearch} className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ulaşım rehberinde ara..."
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-10 top-1.5 h-9 w-9 rounded-full text-gray-400 flex items-center justify-center hover:text-gray-600"
              title="Temizle"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            aria-label="Ulaşım rehberinde ara"
            className="absolute right-1.5 top-1 h-9 w-9 rounded-full text-gray-500 flex items-center justify-center hover:opacity-90"
          >
            <SearchIcon size={18} />
          </button>
        </form>

        {/* Otobüs Hattı Arama */}
        <form onSubmit={onBusSearch} className="relative flex-1">
          <input
            type="text"
            value={busCode}
            onChange={(e) => {
              setBusCode(e.target.value);
            }}
            placeholder="Otobüs hattı ara (ör: 500T)"
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
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

      {searchSearched && (
        <div className="mt-2 relative">
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-gray-500 text-sm py-2">Sonuç bulunamadı.</div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 md:right-auto md:left-0 md:w-[calc(50%-0.25rem)] rounded-xl border border-brand-light-blue bg-white shadow-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {searchResults.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => goToSearchPost(post)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-light-blue/30 transition-colors border-b border-brand-light-blue/30 last:border-b-0 flex items-center gap-3"
                  >
                    <SearchIcon className="w-4 h-4 text-brand-soft-blue flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{post.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {busSearched && (
        <div className="mt-2 relative">
          {!busLoading && busResults.length === 0 && (
            <div className="text-gray-500 text-sm py-2">Eşleşen hat bulunamadı.</div>
          )}
          {!busLoading && busResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 md:left-auto md:right-0 md:w-[calc(50%-0.25rem)] rounded-xl border border-brand-light-blue bg-white shadow-lg overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {busResults.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => goToBusPost(post)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-light-blue/30 transition-colors border-b border-brand-light-blue/30 last:border-b-0 flex items-center gap-3"
                  >
                    <Bus className="w-4 h-4 text-brand-soft-blue flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate">{post.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
