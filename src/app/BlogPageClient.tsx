"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlogCategory, BlogPost } from "@/types/WordPress";
import { fetchPosts } from "@/services/wordpress";
import { Search } from "lucide-react";
import PostListItem from "@/components/blog/PostListItem";
import CategoryScroller from "@/components/blog/CategoryScroller";

export default function BlogPageClient({ categories, initialPosts = [] as BlogPost[], mainCategoriesOnly = false }: { categories: BlogCategory[]; initialPosts?: BlogPost[]; mainCategoriesOnly?: boolean }) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const perPage = 12;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Initial load only - don't run again
  useEffect(() => {
    // Only run if we don't have initial posts from SSR
    if (initialPosts.length === 0) {
      const load = async () => {
        setLoading(true);
        setHasMore(true);
        try {
          const data = await fetchPosts({ per_page: perPage, page: 1 });
          setPosts(data);
          if (data.length < perPage) setHasMore(false);
        } catch {
          setPosts([]);
          setHasMore(false);
        } finally {
          setLoading(false);
        }
      };
      load();
    } else {
      // We have SSR posts, check if there might be more
      if (initialPosts.length < perPage) {
        setHasMore(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await fetchPosts(
        isSearching
          ? { search: searchTerm, per_page: perPage, page: nextPage }
          : { per_page: perPage, page: nextPage }
      );
      setPosts((prev) => [...prev, ...(data || [])]);
      setPage(nextPage);
      if (!data || data.length < perPage) setHasMore(false);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, isSearching, loadingMore, page, perPage, searchTerm]);

  // Observe sentinel to trigger infinite load
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        loadMore();
      }
    }, { rootMargin: "200px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, sentinelRef]);

  const selectedName = useMemo(() => "Son", []);

  const onSubmitSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (term.length < 2) return; // basic guard
    setIsSearching(true);
    setLoading(true);
    setHasMore(true);
    setPage(1);
    try {
      const data = await fetchPosts({ search: term, per_page: perPage, page: 1 });
      setPosts(data);
      if (!data || data.length < perPage) setHasMore(false);
    } catch {
      setPosts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  const clearSearch = useCallback(() => {
    setIsSearching(false);
    setPosts(initialPosts);
    setSearchTerm("");
    setPage(1);
    setHasMore(true);
  }, [initialPosts]);

  return (
    <div className="space-y-6">
      {/* Category Scroller */}
      <CategoryScroller categories={categories} showCounts className="pt-4 pb-2" mainOnly={mainCategoriesOnly} />

      {/* Search Bar */}
      <form onSubmit={onSubmitSearch} className="relative flex gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Yazılarda ara..."
          className="flex-1 border border-brand-light-blue rounded-full px-4 py-3 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
        />
        {isSearching && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-4 py-2 rounded-full text-gray-700 text-sm hover:bg-gray-300"
          >
            Temizle
          </button>
        )}
        <button
          type="submit"
          className="px-6 py-2 rounded-full bg-brand-soft-blue text-white text-sm hover:bg-brand-dark-blue"
        >
          <Search size={18} className="inline" />
        </button>
      </form>

      {/* Status Messages */}
      {loading && <div className="text-center text-gray-500">Yükleniyor…</div>}
      {!loading && posts.length === 0 && <div className="text-center text-gray-500">Yazı bulunamadı.</div>}

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => {
          // Find the post's category
          const postCategoryId = post.categoryIds?.[0];
          const postCategory = postCategoryId ? categories.find(c => c.id === postCategoryId) : null;
          
          // If no category found, create fallback URL
          const href = postCategory 
            ? `/${postCategory.slug}/${post.slug}`
            : `/#/${post.slug}`;
          
          return (
            <PostListItem key={post.id} post={post} href={href} />
          );
        })}
      </div>

      {/* Load More Sentinel */}
      <div ref={sentinelRef} className="py-8 flex justify-center">
        {loadingMore && <div className="text-sm text-gray-500">Daha fazla yazı yükleniyor…</div>}
        {!hasMore && posts.length > 0 && <div className="text-sm text-gray-500">Tüm yazılar yüklendi</div>}
      </div>
    </div>
  );
}
