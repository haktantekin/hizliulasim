import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { 
  fetchCategories, 
  fetchPosts, 
  fetchPostBySlug, 
  fetchCategoryBySlug 
} from '../services/wordpress';
import { BlogCategory, BlogPost } from '../types/WordPress';

// Categories Query Hook
export const useCategories = () => {
  return useQuery<BlogCategory[], Error>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Single Post Hook
export const usePost = (slug: string) => {
  return useQuery<BlogPost | null, Error>({
    queryKey: ['post', slug],
    queryFn: () => fetchPostBySlug(slug),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 3,
    enabled: !!slug,
  });
};

// Single Category Hook
export const useCategory = (slug: string) => {
  return useQuery<BlogCategory | null, Error>({
    queryKey: ['category', slug],
    queryFn: () => fetchCategoryBySlug(slug),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 3,
    enabled: !!slug,
  });
};

// Related Posts Hook (posts from same categories excluding current post)
export const useRelatedPosts = (postId: number, categoryIds: number[], limit: number = 3) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', 'related', postId, categoryIds, limit],
    queryFn: async () => {
      if (!categoryIds.length) return [];
      const posts = await fetchPosts({ 
        categoryId: categoryIds[0], 
        per_page: limit + 10
      });
      return posts
        .filter(post => post.id !== postId)
        .slice(0, limit);
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: 2,
    enabled: !!postId && categoryIds.length > 0,
  });
};

// Infinite Posts by Category Hook (for infinite scroll)
export const useInfinitePostsByCategory = (categoryId: number) => {
  return useInfiniteQuery<BlogPost[], Error>({
    queryKey: ['posts', 'category', 'infinite', categoryId],
    queryFn: ({ pageParam = 1 }) => 
      fetchPosts({
        categoryId,
        per_page: 20,
        page: pageParam as number,
        orderby: 'date',
        order: 'desc',
      }),
    getNextPageParam: (lastPage, allPages) => {
      // If the last page returned fewer than 20 items, there are no more pages
      return lastPage.length === 20 ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    enabled: !!categoryId,
  });
};