"use client";

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCategory, useInfinitePostsByCategory, useCategories } from '../../hooks/useWordPress';
import { BlogPost } from '../../types/WordPress';
import PostListItem from '@/components/blog/PostListItem';
import CategoryScroller from '@/components/blog/CategoryScroller';
import { Search as SearchIcon } from 'lucide-react';
import { fetchPosts } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function MainCategoryPage() {
  const params = useParams<{ mainCategory: string }>();
  const mainCategorySlug = Array.isArray(params.mainCategory) ? params.mainCategory[0] : params.mainCategory;
  
  const { data: mainCategory, isLoading: categoryLoading, isError: categoryError } = useCategory(mainCategorySlug);
  const { 
    data: infiniteData, 
    isLoading: postsLoading, 
    isError: postsError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfinitePostsByCategory(mainCategory?.id || 0);
  const { data: allCategories = [] } = useCategories();

  const isLoading = categoryLoading || postsLoading;
  const isError = categoryError || postsError;

  // Get all posts from infinite pages
  const categoryPosts = infiniteData?.pages.flatMap(page => page) || [];

  // Filter sub-categories (only children of main category)
  const subCategories = allCategories.filter(cat => cat.parentId === mainCategory?.id);

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
    if (!mainCategory?.id) return;
    const term = searchTerm.trim();
    if (term.length < 2) return;
    setSearching(true);
    setSearchLoading(true);
    try {
      const data = await fetchPosts({ categoryId: mainCategory.id, search: term, per_page: 20, page: 1 });
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [mainCategory?.id, searchTerm]);

  const clearSearch = useCallback(() => {
    setSearching(false);
    setSearchResults([]);
    setSearchTerm("");
  }, []);

  if (isError || (!isLoading && !mainCategory)) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Loading skeleton */}
        <div className="animate-pulse">
          <div className="w-32 h-4 bg-gray-200 rounded mb-8"></div>
          <div className="w-24 h-6 bg-gray-200 rounded mb-4"></div>
          <div className="w-64 h-8 bg-gray-200 rounded mb-4"></div>
          <div className="w-96 h-4 bg-gray-200 rounded mb-4"></div>
          <div className="w-20 h-4 bg-gray-200 rounded mb-12"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="border border-brand-light-blue rounded-lg overflow-hidden">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="w-full h-6 bg-gray-200 rounded mb-3"></div>
                  <div className="w-full h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="flex justify-between">
                    <div className="w-24 h-4 bg-gray-200 rounded"></div>
                    <div className="w-32 h-4 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!mainCategory) {
    notFound();
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
          {mainCategory.name}
        </h1>
        <p className="text-sm text-gray-400 mb-2 font-light">
          {mainCategory.description || `${mainCategory.name} kategorisindeki yazılar`}
        </p>

        {/* Search Bar scoped to this category */}
        <div className="mt-3">
          <form onSubmit={onSubmitSearch} className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`${mainCategory.name} içinde ara`}
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
          <h2 className="text-lg font-semibold mb-3">"{searchTerm.trim()}" için sonuçlar</h2>
          {searchLoading && <div className="text-sm text-gray-500">Yükleniyor…</div>}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-gray-600 text-sm">Sonuç bulunamadı.</div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((post: BlogPost) => {
                const postCategoryId = post.categoryIds?.[0];
                const postCategory = postCategoryId
                  ? allCategories.find(c => c.id === postCategoryId)
                  : null;
                const postMainCategory = postCategory?.parentId
                  ? allCategories.find(c => c.id === postCategory.parentId)
                  : null;
                const href = postMainCategory && postCategory && postCategory.parentId
                  ? `/${postMainCategory.slug}/${postCategory.slug}/${post.slug}`
                  : postCategory && !postCategory.parentId
                  ? `/${postCategory.slug}/${post.slug}`
                  : `/${mainCategory.slug}/#/${post.slug}`;
                return (
                  <PostListItem 
                    key={post.id} 
                    post={post} 
                    href={href}
                    categorySlug={postCategory?.slug}
                    categoryName={postCategory?.name}
                  />
                );
              })}
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
            {categoryPosts.map((post: BlogPost) => {
              const postCategoryId = post.categoryIds?.[0];
              const postCategory = postCategoryId
                ? allCategories.find(c => c.id === postCategoryId)
                : null;
              const postMainCategory = postCategory?.parentId
                ? allCategories.find(c => c.id === postCategory.parentId)
                : null;
              const href = postMainCategory && postCategory && postCategory.parentId
                ? `/${postMainCategory.slug}/${postCategory.slug}/${post.slug}`
                : postCategory && !postCategory.parentId
                ? `/${postCategory.slug}/${post.slug}`
                : `/${mainCategory.slug}/#/${post.slug}`;
              return (
                <PostListItem 
                  key={post.id} 
                  post={post} 
                  href={href}
                  categorySlug={postCategory?.slug}
                  categoryName={postCategory?.name}
                />
              );
            })}
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
