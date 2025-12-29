"use client";

import React, { useCallback, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCategory, useInfinitePostsByCategory, useCategories, usePost, useRelatedPosts } from '../../../hooks/useWordPress';
import { BlogPost } from '../../../types/WordPress';
import PostListItem from '@/components/blog/PostListItem';
import CategoryScroller from '@/components/blog/CategoryScroller';
import { Search as SearchIcon } from 'lucide-react';
import { fetchPosts } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function SubCategoryPage() {
  const params = useParams<{ mainCategory: string; category: string }>();
  const mainCategorySlug = Array.isArray(params.mainCategory) ? params.mainCategory[0] : params.mainCategory;
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;
  
  const { data: category, isLoading: categoryLoading, isError: categoryError } = useCategory(categorySlug);
  const { data: allCategories = [] } = useCategories();
  const { data: post, isLoading: postLoading, isError: postError } = usePost(categorySlug);
  
  const { 
    data: infiniteData, 
    isLoading: postsLoading, 
    isError: postsError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfinitePostsByCategory(category?.id || 0);
  const { data: relatedPosts = [] } = useRelatedPosts(post?.id || 0, post?.categoryIds || [], 6);

  const isLoading = categoryLoading || postsLoading || postLoading;
  const isError = categoryError || postsError || postError;

  // Get all posts from infinite pages
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
    if (!category?.id) return;
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
  }, [category?.id, searchTerm]);

  const clearSearch = useCallback(() => {
    setSearching(false);
    setSearchResults([]);
    setSearchTerm("");
  }, []);

  if (isError || (!isLoading && !category && !post)) {
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

  // Eğer ikinci segment bir kategori değil ama bir yazıysa: yazı detayı
  if (post && !category) {
    const postCategoryId = post.categoryIds?.[0];
    const postCategory = postCategoryId
      ? allCategories.find(c => c.id === postCategoryId)
      : null;
    const postMainCategory = postCategory?.parentId
      ? allCategories.find(c => c.id === postCategory.parentId)
      : allCategories.find(c => c.slug === mainCategorySlug) || null;

    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumb
          className="mb-4"
          items={[
            { label: 'Kategoriler', href: '/kategoriler' },
            ...(postMainCategory ? [{ label: postMainCategory.name, href: `/${postMainCategory.slug}` }] : []),
            ...(postCategory && postMainCategory && postCategory.parentId
              ? [{ label: postCategory.name, href: `/${postMainCategory.slug}/${postCategory.slug}` }]
              : []),
          ]}
        />

        <h1 className="text-2xl font-bold mb-4 text-brand-soft-blue">{post.title}</h1>

        {post.featuredImage && (
          <div className="relative w-full h-64 md:h-96 mb-6">
            <Image
              src={post.featuredImage.url}
              alt={post.featuredImage.alt}
              fill
              className="object-cover rounded-lg"
              priority
            />
          </div>
        )}

        <div className="text-xs text-gray-500 mb-4">
          <span>{new Date(post.publishedAt).toLocaleDateString('tr-TR')}</span>
        </div>

        <article className="post-detail">
          <div dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>

        {relatedPosts && relatedPosts.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold mb-4">İlgili İçerikler</h2>
            <div className="divide-y divide-gray-200">
              {relatedPosts.map((rp) => {
                const rpCategoryId = rp.categoryIds?.[0];
                const rpCategory = rpCategoryId
                  ? allCategories.find(c => c.id === rpCategoryId)
                  : null;
                const rpMainCategory = rpCategory?.parentId
                  ? allCategories.find(c => c.id === rpCategory.parentId)
                  : postMainCategory;
                const href = rpMainCategory && rpCategory
                  ? `/${rpMainCategory.slug}/${rpCategory.slug}/${rp.slug}`
                  : `/${mainCategorySlug}/${rp.slug}`;

                return (
                  <PostListItem
                    key={rp.id}
                    post={rp}
                    href={href}
                    className="py-3"
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  // Ne kategori ne yazı bulunamadı
  if (!category) {
    notFound();
  }

  // Normal kategori liste sayfası
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      {(() => {
        const parentCategory = category?.parentId 
          ? allCategories.find(c => c.id === category.parentId)
          : null;
        const mainCatForBreadcrumb = parentCategory || allCategories.find(c => c.slug === mainCategorySlug);
        return (
          <Breadcrumb
            className="mb-4"
            items={[
              { label: 'Kategoriler', href: '/kategoriler' },
              ...(mainCatForBreadcrumb ? [{ label: mainCatForBreadcrumb.name, href: `/${mainCatForBreadcrumb.slug}` }] : []),
            ]}
          />
        );
      })()}

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
                const postMainCategorySlug = category?.parentId 
                  ? allCategories.find(c => c.id === category.parentId)?.slug 
                  : mainCategorySlug;
                return (
                  <PostListItem 
                    key={post.id} 
                    post={post} 
                    href={`/${postMainCategorySlug}/${category.slug}/${post.slug}`} 
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
              const postMainCategorySlug = category?.parentId 
                ? allCategories.find(c => c.id === category.parentId)?.slug 
                : mainCategorySlug;
              return (
                <PostListItem 
                  key={post.id} 
                  post={post} 
                  href={`/${postMainCategorySlug}/${category.slug}/${post.slug}`} 
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
