"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { BlogCategory, BlogPost } from "@/types/WordPress";
import { fetchPosts } from "@/services/wordpress";
import { Search } from "lucide-react";
import PostListItem from "@/components/blog/PostListItem";
import CategoryScroller from "@/components/blog/CategoryScroller";

const EMPTY_POSTS: BlogPost[] = [];
const PER_PAGE = 12;

interface BlogState {
  posts: BlogPost[];
  loading: boolean;
  loadingMore: boolean;
  page: number;
  hasMore: boolean;
  searchTerm: string;
  isSearching: boolean;
}

type BlogAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; posts: BlogPost[] }
  | { type: 'LOAD_FAIL' }
  | { type: 'LOAD_MORE_START' }
  | { type: 'LOAD_MORE_SUCCESS'; posts: BlogPost[]; nextPage: number }
  | { type: 'LOAD_MORE_FAIL' }
  | { type: 'SEARCH_START' }
  | { type: 'SEARCH_SUCCESS'; posts: BlogPost[] }
  | { type: 'SEARCH_FAIL' }
  | { type: 'SET_SEARCH_TERM'; value: string }
  | { type: 'CLEAR_SEARCH'; initialPosts: BlogPost[] };

function blogReducer(state: BlogState, action: BlogAction): BlogState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, hasMore: true };
    case 'LOAD_SUCCESS':
      return { ...state, loading: false, posts: action.posts, hasMore: action.posts.length >= PER_PAGE };
    case 'LOAD_FAIL':
      return { ...state, loading: false, posts: [], hasMore: false };
    case 'LOAD_MORE_START':
      return { ...state, loadingMore: true };
    case 'LOAD_MORE_SUCCESS':
      return { ...state, loadingMore: false, posts: [...state.posts, ...action.posts], page: action.nextPage, hasMore: action.posts.length >= PER_PAGE };
    case 'LOAD_MORE_FAIL':
      return { ...state, loadingMore: false, hasMore: false };
    case 'SEARCH_START':
      return { ...state, isSearching: true, loading: true, hasMore: true, page: 1 };
    case 'SEARCH_SUCCESS':
      return { ...state, loading: false, posts: action.posts, hasMore: action.posts.length >= PER_PAGE };
    case 'SEARCH_FAIL':
      return { ...state, loading: false, posts: [], hasMore: false };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.value };
    case 'CLEAR_SEARCH':
      return { ...state, isSearching: false, posts: action.initialPosts, searchTerm: '', page: 1, hasMore: true };
    default:
      return state;
  }
}

export default function BlogPageClient({ categories, initialPosts = EMPTY_POSTS, mainCategoriesOnly = false }: { categories: BlogCategory[]; initialPosts?: BlogPost[]; mainCategoriesOnly?: boolean }) {
  const [state, dispatch] = useReducer(blogReducer, {
    posts: initialPosts,
    loading: false,
    loadingMore: false,
    page: 1,
    hasMore: initialPosts.length >= PER_PAGE,
    searchTerm: '',
    isSearching: false,
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Initial load only - don't run again
  useEffect(() => {
    if (initialPosts.length === 0) {
      const load = async () => {
        dispatch({ type: 'LOAD_START' });
        try {
          const data = await fetchPosts({ per_page: PER_PAGE, page: 1 });
          dispatch({ type: 'LOAD_SUCCESS', posts: data });
        } catch {
          dispatch({ type: 'LOAD_FAIL' });
        }
      };
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore) return;
    dispatch({ type: 'LOAD_MORE_START' });
    const nextPage = state.page + 1;
    try {
      const data = await fetchPosts(
        state.isSearching
          ? { search: state.searchTerm, per_page: PER_PAGE, page: nextPage }
          : { per_page: PER_PAGE, page: nextPage }
      );
      dispatch({ type: 'LOAD_MORE_SUCCESS', posts: data || [], nextPage });
    } catch {
      dispatch({ type: 'LOAD_MORE_FAIL' });
    }
  }, [state.hasMore, state.isSearching, state.loadingMore, state.page, state.searchTerm]);

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

  const selectedName = "Son";

  const onSubmitSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const term = state.searchTerm.trim();
    if (term.length < 2) return;
    dispatch({ type: 'SEARCH_START' });
    try {
      const data = await fetchPosts({ search: term, per_page: PER_PAGE, page: 1 });
      dispatch({ type: 'SEARCH_SUCCESS', posts: data });
    } catch {
      dispatch({ type: 'SEARCH_FAIL' });
    }
  }, [state.searchTerm]);

  const clearSearch = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH', initialPosts });
  }, [initialPosts]);

  return (
    <div className="space-y-6">
      {/* Category Scroller */}
      <CategoryScroller categories={categories} allCategories={categories} showCounts className="pt-4 pb-2" mainOnly={mainCategoriesOnly} />

      {/* Search Bar */}
      <form onSubmit={onSubmitSearch} className="relative flex gap-2">
        <input
          type="text"
          value={state.searchTerm}
          onChange={(e) => dispatch({ type: 'SET_SEARCH_TERM', value: e.target.value })}
          placeholder="Yazılarda ara..."
          className="flex-1 border border-brand-light-blue rounded-full px-4 py-3 text-gray-700 font-light placeholder-gray-500 transition-colors text-sm"
        />
        {state.isSearching && (
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
      {state.loading && <div className="text-center text-gray-500">Yükleniyor…</div>}
      {!state.loading && state.posts.length === 0 && <div className="text-center text-gray-500">Yazı bulunamadı.</div>}

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.posts.map((post) => {
          // Find the post's category
          const postCategoryId = post.categoryIds?.[0];
          const postCategory = postCategoryId ? categories.find(c => c.id === postCategoryId) : null;
          
          // If category has a parent, build hierarchical URL
          const postMainCategory = postCategory?.parentId 
            ? categories.find(c => c.id === postCategory.parentId)
            : null;
          
          // Build href
          const href = postMainCategory && postCategory && postCategory.parentId
            ? `/${postMainCategory.slug}/${postCategory.slug}/${post.slug}`
            : postCategory && !postCategory.parentId
            ? `/${postCategory.slug}/${post.slug}`
            : `/#/${post.slug}`;
          
          return (
            <PostListItem key={post.id} post={post} href={href} />
          );
        })}
      </div>

      {/* Load More Sentinel */}
      <div ref={sentinelRef} className="py-8 flex justify-center">
        {state.loadingMore && <div className="text-sm text-gray-500">Daha fazla yazı yükleniyor…</div>}
        {!state.hasMore && state.posts.length > 0 && <div className="text-sm text-gray-500">Tüm yazılar yüklendi</div>}
      </div>
    </div>
  );
}
