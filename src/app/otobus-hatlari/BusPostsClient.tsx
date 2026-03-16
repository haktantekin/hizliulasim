"use client";

import React, { useCallback, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { BlogCategory, BlogPost } from '../../types/WordPress';
import CategoryScroller from '@/components/blog/CategoryScroller';
import { Search as SearchIcon, ChevronRight, Heart } from 'lucide-react';
import { fetchPosts } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { useAppSelector } from '@/store/hooks';
import { useUpdateFavorite } from '@/hooks/useAuth';
import AuthModal from '@/components/ui/AuthModal';

interface Props {
  category: BlogCategory;
  allCategories: BlogCategory[];
  subCategories: BlogCategory[];
  initialPosts: BlogPost[];
}

export default function BusPostsClient({ category, allCategories, subCategories, initialPosts }: Props) {
  const {
    data: infiniteData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<BlogPost[], Error>({
    queryKey: ['posts', 'category', 'infinite', category.id],
    queryFn: ({ pageParam = 1 }) =>
      fetchPosts({
        categoryId: category.id,
        per_page: 20,
        page: pageParam as number,
        orderby: 'title',
        order: 'asc',
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    initialData: { pages: [initialPosts], pageParams: [1] },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const categoryPosts = infiniteData?.pages.flatMap(page => page) || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);

  const observerTarget = useRef<HTMLDivElement>(null);

  const { isAuthenticated, favorites } = useAppSelector((state) => state.user);
  const updateFavorite = useUpdateFavorite();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !searching) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searching]);

  const onSubmitSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2) return;
    setSearching(true);
    setSearchLoading(true);
    try {
      const data = await fetchPosts({ categoryId: category.id, search: term, per_page: 20, page: 1 });
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [category.id, searchTerm]);

  const clearSearch = useCallback(() => {
    setSearching(false);
    setSearchResults([]);
    setSearchTerm("");
  }, []);

  function buildPostHref(post: BlogPost): string {
    const postCategoryId = post.categoryIds?.[0];
    const postCategory = postCategoryId ? allCategories.find(c => c.id === postCategoryId) : null;
    const postMainCategory = postCategory?.parentId
      ? allCategories.find(c => c.id === postCategory.parentId)
      : null;
    if (postMainCategory && postCategory?.parentId) {
      return `/${postMainCategory.slug}/${postCategory.slug}/${post.slug}`;
    }
    if (postCategory && !postCategory.parentId) {
      return `/${postCategory.slug}/${post.slug}`;
    }
    return `/${category.slug}/${post.slug}`;
  }

  const renderTitleList = (posts: BlogPost[]) => (
    <div className="divide-y divide-gray-100 mt-4">
      {posts.map((post) => {
        const hatKodu = post.slug.toUpperCase();
        const isFav = isAuthenticated && favorites.routes.some((r) => r.id === hatKodu);
        return (
          <div key={post.id} className="flex items-center py-3 px-2 hover:bg-gray-50 rounded-lg transition-colors group gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isAuthenticated) { setAuthModalOpen(true); return; }
                updateFavorite.mutate({
                  type: 'routes',
                  action: isFav ? 'remove' : 'add',
                  item: { id: hatKodu, name: post.title },
                });
              }}
              className="flex-shrink-0 p-1.5 rounded-full hover:bg-orange-50 transition-colors mr-1"
              aria-label={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            >
              <Heart
                size={16}
                className={`transition-colors ${
                  isFav ? 'text-brand-orange fill-brand-orange' : 'text-gray-300 group-hover:text-gray-400'
                }`}
              />
            </button>
            <Link
              href={buildPostHref(post)}
              className="flex items-center flex-1 min-w-0 mr-4"
            >
              <span className="text-sm text-gray-800 group-hover:text-brand-soft-blue transition-colors truncate">
                {post.title}
              </span>
            </Link>
            <Link href={buildPostHref(post)} className="flex-shrink-0 ml-1">
              <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-soft-blue transition-colors" />
            </Link>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
    <div className="container mx-auto px-4 py-8">
      <div className="mb-2">
        <h1 className="text-xl font-bold mb-1 text-brand-soft-blue">{category.name}</h1>
        <p className="text-sm text-gray-400 mb-2 font-light">
          {category.description || `${category.name} kategorisindeki yazılar`}
        </p>
      </div>

      <Breadcrumb className="mb-4" items={[{ label: 'Kategoriler', href: '/kategoriler' }]} />

      <div className="mt-3 mb-6">
        <form onSubmit={onSubmitSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`${category.name} içinde ara`}
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-28 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
          />
          {searching && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-12 top-1.5 h-9 px-3 rounded-full text-gray-700 text-sm hover:bg-gray-300"
            >
              Temizle
            </button>
          )}
          <button
            type="submit"
            aria-label="Kategori içinde ara"
            className="absolute right-1.5 top-1 h-9 w-9 rounded-full text-gray-500 flex items-center justify-center hover:opacity-90"
          >
            <SearchIcon size={18} />
          </button>
        </form>
      </div>

      {subCategories.length > 0 && (
        <CategoryScroller
          categories={subCategories}
          allCategories={allCategories}
          showCounts
          className="mt-3"
        />
      )}

      {searching ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">&ldquo;{searchTerm.trim()}&rdquo; için sonuçlar</h2>
          {searchLoading && <div className="text-sm text-gray-500">Yükleniyor…</div>}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-gray-600 text-sm">Sonuç bulunamadı.</div>
          )}
          {!searchLoading && searchResults.length > 0 && renderTitleList(searchResults)}
        </div>
      ) : !categoryPosts || categoryPosts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Bu kategoride henüz gönderi bulunmuyor.</p>
          <Link
            href="/kategoriler"
            className="text-brand-soft-blue hover:text-brand-dark-blue font-medium mt-4 inline-block"
          >
            ← Kategoriler&apos;e geri dön
          </Link>
        </div>
      ) : (
        <>
          {renderTitleList(categoryPosts)}

          <div ref={observerTarget} className="mt-8 flex justify-center">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-soft-blue"></div>
                <span className="text-sm text-gray-600">Daha fazla yazı yükleniyor…</span>
              </div>
            )}
            {!hasNextPage && categoryPosts.length > 0 && (
              <p className="text-sm text-gray-500">Tüm yazılar yüklendi</p>
            )}
          </div>
        </>
      )}
    </div>
    <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
