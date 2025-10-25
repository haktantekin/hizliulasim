"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlogCategory, BlogPost } from "@/types/WordPress";
import { fetchPosts } from "@/services/wordpress";
import { Search } from "lucide-react";
import PostListItem from "@/components/blog/PostListItem";
import CategoryScroller from "@/components/blog/CategoryScroller";

export default function BlogPageClient({ categories, initialPosts = [] as BlogPost[] }: { categories: BlogCategory[]; initialPosts?: BlogPost[] }) {
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
  }, [perPage, searchTerm]);

  // Note: clear search handled implicitly by selecting a category or submitting empty term

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {/* Search Bar (styled like home SearchBar) */}
        <form onSubmit={onSubmitSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Blog'da ara"
            className="w-full border border-brand-light-blue rounded-full px-4 py-3 pr-12 text-gray-700 placeholder-brand-soft-blue transition-colors"
          />
          <button
            type="submit"
            aria-label="Blog'da ara"
            className="absolute right-1.5 top-1.5 h-9 w-9 rounded-full text-brand-soft-blue flex items-center justify-center hover:opacity-90"
          >
            <Search size={18} />
          </button>
        </form>

        <CategoryScroller categories={categories} showCounts />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">
          {isSearching ? `“${searchTerm.trim()}” için sonuçlar` : `${selectedName} Gönderiler`}
        </h2>
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-brand-light-blue rounded-lg overflow-hidden animate-pulse">
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 w-2/3" />
                  <div className="h-3 bg-gray-200 w-full" />
                  <div className="h-3 bg-gray-200 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && posts && posts.length === 0 && (
          <div className="text-gray-600 text-sm">Bu kategoride gönderi bulunamadı.</div>
        )}
        {!loading && posts && posts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostListItem
                key={post.id}
                post={post}
                href={`/blog/${(categories.find(c => post.categoryIds.includes(c.id))?.slug) || 'genel'}/${post.slug}`}
              />
            ))}
          </div>
        )}
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-8" />
        {loadingMore && (
          <div className="text-center text-sm text-gray-500">Yükleniyor…</div>
        )}
        {!hasMore && posts.length > 0 && (
          <div className="text-center text-xs text-gray-400 mt-2">Hepsi yüklendi.</div>
        )}
      </div>
    </div>
  );
}
