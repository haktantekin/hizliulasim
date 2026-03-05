'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search as SearchIcon, X, Bus } from 'lucide-react';
import { fetchPosts, fetchCategories } from '@/services/wordpress';
import type { BlogPost, BlogCategory } from '@/types/WordPress';
import PostListItem from '@/components/blog/PostListItem';

export default function HomeSearchBar() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);
  const [allCategories, setAllCategories] = useState<BlogCategory[]>([]);

  const [busCode, setBusCode] = useState('');

  const onSubmitSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2) return;

    setSearching(true);
    setSearchLoading(true);
    try {
      // Fetch categories to find ulasim-rehberi
      const categories = await fetchCategories();
      setAllCategories(categories);
      const ulasimRehberi = categories.find(c => c.slug === 'ulasim-rehberi');

      const data = await fetchPosts({
        categoryId: ulasimRehberi?.id,
        search: term,
        per_page: 10,
        page: 1,
      });
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchTerm]);

  const clearSearch = useCallback(() => {
    setSearching(false);
    setSearchResults([]);
    setSearchTerm('');
  }, []);

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

  const onBusSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const code = busCode.trim();
    if (!code) return;
    router.push(`/otobus-hatlari/${encodeURIComponent(code)}`);
  }, [busCode, router]);

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
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-28 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
          />
          {searching && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1.5 h-9 px-3 rounded-full text-gray-700 text-sm hover:bg-gray-300 flex items-center gap-1"
              title="Aramayı temizle"
            >
              <X size={14} />
              Temizle
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
            onChange={(e) => setBusCode(e.target.value)}
            placeholder="Otobüs hattı ara (ör: 500T)"
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
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

      {searching && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-3">
            &ldquo;{searchTerm.trim()}&rdquo; için sonuçlar
          </h2>
          {searchLoading && (
            <div className="text-sm text-gray-500">Yükleniyor…</div>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-gray-600 text-sm">Sonuç bulunamadı.</div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((post) => (
                <PostListItem
                  key={post.id}
                  post={post}
                  href={buildPostHref(post)}
                  categorySlug={allCategories.find(c => c.id === post.categoryIds?.[0])?.slug}
                  categoryName={allCategories.find(c => c.id === post.categoryIds?.[0])?.name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
