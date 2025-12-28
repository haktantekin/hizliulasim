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
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Posts Query Hook
export const usePosts = (params?: {
  categoryId?: number;
  per_page?: number;
  page?: number;
  search?: string;
}) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', params],
    queryFn: () => fetchPosts(params),
    staleTime: 1000 * 60 * 2, // 2 minutes for posts (more frequent updates)
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Recent Posts Hook (for homepage)
export const useRecentPosts = (limit: number = 6) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', 'recent', limit],
    queryFn: () => fetchPosts({ per_page: limit }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  });
};

// Posts by Category Hook
export const usePostsByCategory = (categoryId: number, limit?: number) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', 'category', categoryId, limit],
    queryFn: () => fetchPosts({ 
      categoryId, 
      per_page: limit || 20 
    }),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    enabled: !!categoryId, // Only run if categoryId exists
  });
};

// Single Post Hook
export const usePost = (slug: string) => {
  return useQuery<BlogPost | null, Error>({
    queryKey: ['post', slug],
    queryFn: () => fetchPostBySlug(slug),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    enabled: !!slug, // Only run if slug exists
  });
};

// Single Category Hook
export const useCategory = (slug: string) => {
  return useQuery<BlogCategory | null, Error>({
    queryKey: ['category', slug],
    queryFn: () => fetchCategoryBySlug(slug),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3,
    enabled: !!slug, // Only run if slug exists
  });
};

// Related Posts Hook (posts from same categories excluding current post)
export const useRelatedPosts = (postId: number, categoryIds: number[], limit: number = 3) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', 'related', postId, categoryIds, limit],
    queryFn: async () => {
      if (!categoryIds.length) return [];
      
      // Get posts from the first category (can be enhanced to get from all categories)
      const posts = await fetchPosts({ 
        categoryId: categoryIds[0], 
        per_page: limit + 10 // Get extra to filter out current post
      });
      
      // Filter out current post and limit results
      return posts
        .filter(post => post.id !== postId)
        .slice(0, limit);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    enabled: !!postId && categoryIds.length > 0,
  });
};

// Search Posts Hook
export const useSearchPosts = (searchTerm: string, limit: number = 10) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', 'search', searchTerm, limit],
    queryFn: () => fetchPosts({ 
      search: searchTerm,
      per_page: limit 
    }),
    staleTime: 1000 * 60 * 1, // 1 minute for search results
    gcTime: 1000 * 60 * 3, // 3 minutes
    retry: 2,
    enabled: searchTerm.length > 2, // Only search if term is longer than 2 chars
  });
};

// Combined Categories and Recent Posts Hook (for homepage)
export const useBlogHomepage = () => {
  const categoriesQuery = useCategories();
  const recentPostsQuery = useRecentPosts(6);

  return {
    categories: categoriesQuery.data || [],
    recentPosts: recentPostsQuery.data || [],
    isLoading: categoriesQuery.isLoading || recentPostsQuery.isLoading,
    isError: categoriesQuery.isError || recentPostsQuery.isError,
    error: categoriesQuery.error || recentPostsQuery.error,
  };
};

// Latest posts by category (ordered by date desc)
export const useLatestPostsByCategory = (categoryId: number, limit: number = 9) => {
  return useQuery<BlogPost[], Error>({
    queryKey: ['posts', 'category', 'latest', categoryId, limit],
    queryFn: () => fetchPosts({
      categoryId,
      per_page: limit,
      orderby: 'date',
      order: 'desc',
    }),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: 2,
    enabled: !!categoryId,
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