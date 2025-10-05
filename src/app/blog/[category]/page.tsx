"use client";

import React, { useCallback, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCategory, usePostsByCategory, useCategories } from '../../../hooks/useWordPress';
import { BlogPost } from '../../../types/WordPress';
import PostListItem from '@/components/blog/PostListItem';
import CategoryScroller from '@/components/blog/CategoryScroller';
import { Search as SearchIcon } from 'lucide-react';
import { fetchPosts } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;
  const { data: category, isLoading: categoryLoading, isError: categoryError } = useCategory(categorySlug);
  const { data: categoryPosts, isLoading: postsLoading, isError: postsError } = usePostsByCategory(
    category?.id || 0,
    20
  );
  const { data: allCategories = [] } = useCategories();

  const isLoading = categoryLoading || postsLoading;
  const isError = categoryError || postsError;

  // Local state for category-scoped search
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);

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

  if (isError || (!isLoading && !category)) {
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
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
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

  if (!category) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-8"
        items={[{ label: 'Blog', href: '/blog' }]}
      />

      {/* Category Header */}
      <div className="mb-8">
  
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          {category.name}
        </h1>
        <p className="text-md text-gray-400 mb-2">
          {category.description || `${category.name} kategorisindeki yazılar`}
        </p>
    

    {/* Search Bar scoped to this category */}
        <div className="mt-4">
          <form onSubmit={onSubmitSearch} className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`${category.name} içinde ara`}
              className="w-full bg-gray-100 rounded-full px-4 py-3 pr-28 text-gray-700 placeholder-gray-500 transition-colors"
            />
            {searching && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-12 top-1.5 h-9 px-3 rounded-full bg-gray-200 text-gray-700 text-sm hover:bg-gray-300"
                title="Aramayı temizle"
              >
                Temizle
              </button>
            )}
            <button
              type="submit"
              aria-label="Kategori içinde ara"
              className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full bg-brand-dark-blue text-white flex items-center justify-center hover:opacity-90"
            >
              <SearchIcon size={18} />
            </button>
          </form>
        </div>

        <CategoryScroller categories={allCategories} activeSlug={category.slug} showCounts className="mt-3" />
      </div>

      {/* Posts Grid (match Blog page design). If searching, show results scoped to this category */}
      {searching ? (
        <div>
          <h2 className="text-lg font-semibold mb-3">“{searchTerm.trim()}” için sonuçlar</h2>
          {searchLoading && <div className="text-sm text-gray-500">Yükleniyor…</div>}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-gray-600 text-sm">Sonuç bulunamadı.</div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((post: BlogPost) => (
                <PostListItem key={post.id} post={post} href={`/blog/${category.slug}/${post.slug}`} />
              ))}
            </div>
          )}
        </div>
      ) : !categoryPosts || categoryPosts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Bu kategoride henüz gönderi bulunmuyor.</p>
          <Link 
            href="/blog"
            className="text-brand-soft-blue hover:text-brand-dark-blue font-medium mt-4 inline-block"
          >
            ← Blog&apos;a geri dön
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categoryPosts.map((post: BlogPost) => (
            <PostListItem key={post.id} post={post} href={`/blog/${category.slug}/${post.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}