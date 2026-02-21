"use client";

import React, { useCallback, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useInfiniteQuery } from '@tanstack/react-query';
import { BlogCategory, BlogPost } from '../../types/WordPress';
import PostListItem from '@/components/blog/PostListItem';
import CategoryScroller from '@/components/blog/CategoryScroller';
import { Search as SearchIcon } from 'lucide-react';
import { fetchPosts } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';

interface Props {
  category: BlogCategory;
  allCategories: BlogCategory[];
  subCategories: BlogCategory[];
  initialPosts: BlogPost[];
}

export default function MainCategoryClient({ category, allCategories, subCategories, initialPosts }: Props) {
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
        orderby: 'date',
        order: 'desc',
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 20 ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    initialData: { pages: [initialPosts], pageParams: [1] },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const categoryPosts = infiniteData?.pages.flatMap(page => page) || [];

  // Local state for category-scoped search
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);

  // Intersection observer for infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !searching) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
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

  /** Resolve the display URL for a given post */
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-4"
        items={[{ label: 'Kategoriler', href: '/kategoriler' }]}
      />

      {/* Category Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 text-brand-soft-blue">
          {category.name}
        </h1>
        <p className="text-sm text-gray-400 mb-2 font-light">
          {category.description || `${category.name} kategorisindeki yazılar`}
        </p>

        {/* Search Bar scoped to this category */}
        <div className="mt-3">
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
                title="Aramayı temizle"
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

        {/* Sub-categories scroller */}
        {subCategories.length > 0 && (
          <CategoryScroller
            categories={subCategories}
            allCategories={allCategories}
            showCounts
            className="mt-3"
          />
        )}
      </div>

      {/* Posts Grid */}
      {searching ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">&ldquo;{searchTerm.trim()}&rdquo; için sonuçlar</h2>
          {searchLoading && <div className="text-sm text-gray-500">Yükleniyor…</div>}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-gray-600 text-sm">Sonuç bulunamadı.</div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((post: BlogPost) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryPosts.map((post: BlogPost) => (
              <PostListItem
                key={post.id}
                post={post}
                href={buildPostHref(post)}
                categorySlug={allCategories.find(c => c.id === post.categoryIds?.[0])?.slug}
                categoryName={allCategories.find(c => c.id === post.categoryIds?.[0])?.name}
              />
            ))}
          </div>

          {/* Infinite scroll loading indicator */}
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
  );
}
