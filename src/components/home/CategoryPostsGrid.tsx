import Link from 'next/link';
import { fetchCategories, fetchPosts } from '@/services/wordpress';
import PostListItem from '../blog/PostListItem';
import TopRestaurantsCarousel from './TopRestaurantsCarousel';
import TopCafesCarousel from './TopCafesCarousel';

const CategoryPostsGrid = async () => {
  try {
    // Fetch all main categories (those without parent)
    const allCategories = await fetchCategories();
    const mainCategories = allCategories.filter(cat => !cat.parentId);
    // Kategorileri 3 gruba böl
    const total = mainCategories.length;
    const groupSize = Math.ceil(total / 3) || 1;
    const group1 = mainCategories.slice(0, groupSize);
    const group2 = mainCategories.slice(groupSize, groupSize * 2);
    const group3 = mainCategories.slice(groupSize * 2);

    async function fetchCategoryGroup(categories: typeof mainCategories) {
      const promises = categories.map(async (category) => {
        try {
          const posts = await fetchPosts({
            categoryId: category.id,
            per_page: 5,
            page: 1,
            orderby: 'date',
            order: 'desc',
          });
          return { category, posts };
        } catch {
          return { category, posts: [] };
        }
      });
      return Promise.all(promises);
    }

    // 3 farklı sorgu
    const group1Posts = await fetchCategoryGroup(group1);
    const group2Posts = await fetchCategoryGroup(group2);
    const group3Posts = await fetchCategoryGroup(group3);

    // Get Ulaşım Rehberi category and its sub-categories
    const ulasimRehberiCategory = allCategories.find(cat => cat.slug === 'ulasim-rehberi');
    const ulasimSubCategories = ulasimRehberiCategory 
      ? allCategories.filter(cat => cat.parentId === ulasimRehberiCategory.id)
      : [];

    // Fetch 6 posts from Ulaşım Rehberi sub-categories
    let ulasimSubCategoryPosts: Array<{ category: typeof mainCategories[0]; posts: Awaited<ReturnType<typeof fetchPosts>> }> = [];
    if (ulasimSubCategories.length > 0) {
      try {
        const subCategoryPostsData = await Promise.all(
          ulasimSubCategories.map(async (subCat) => {
            try {
              const posts = await fetchPosts({
                categoryId: subCat.id,
                per_page: 6,
                page: 1,
                orderby: 'date',
                order: 'desc',
              });
              return { category: subCat, posts };
            } catch {
              return { category: subCat, posts: [] };
            }
          })
        );
        ulasimSubCategoryPosts = subCategoryPostsData;
      } catch (error) {
        console.error('Error fetching Ulaşım Rehberi sub-categories posts:', error);
      }
    }

    const renderCategoryBlock = (category: (typeof mainCategories)[number], posts: Awaited<ReturnType<typeof fetchPosts>>) => {
      if (!posts || posts.length === 0) return null;

      // Check if category has a parent (sub-category)
      const parentCategory = category.parentId 
        ? allCategories.find(c => c.id === category.parentId)
        : null;

      // Build category link
      const categoryHref = parentCategory 
        ? `/${parentCategory.slug}/${category.slug}`
        : `/${category.slug}`;

      return (
        <div key={category.id} className="mb-12">
          {/* Category Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-brand-soft-blue mb-1">
                {category.name}
              </h2>
              <p className="text-sm text-gray-400">
                {category.description}
              </p>
            </div>
            <Link
              href={categoryHref}
              className="px-4 py-2 bg-brand-soft-blue text-white rounded-lg hover:bg-brand-dark-blue transition-colors text-sm font-medium whitespace-nowrap"
            >
              Tümünü Gör
            </Link>
          </div>

          {/* Posts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => {
              // Find the first category that belongs to this main category
              const postCategoryId = post.categoryIds?.[0];
              const postCategory = postCategoryId
                ? allCategories.find(c => c.id === postCategoryId)
                : null;

              // If post is in a sub-category, find the main category
              const postMainCategory = postCategory?.parentId
                ? allCategories.find(c => c.id === postCategory.parentId)
                : null;

              // Build href - only use main/sub format if post has a parent category
              const href = postMainCategory && postCategory && postCategory.parentId
                ? `/${postMainCategory.slug}/${postCategory.slug}/${post.slug}`
                : postCategory && !postCategory.parentId
                ? `/${postCategory.slug}/${post.slug}`
                : `/${category.slug}/#/${post.slug}`;

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
        </div>
      );
    };

    return (
      <div>
        {/* 1. grup kategoriler */}
         {group3Posts.map(({ category, posts }) => renderCategoryBlock(category, posts))}
     
        {/* Ulaşım Rehberi alt kategorileri */}
        {ulasimSubCategoryPosts.length > 0 && ulasimSubCategoryPosts.map(({ category, posts }) => renderCategoryBlock(category, posts))}

        {/* 2. grup kategoriler */}
        {group2Posts.map(({ category, posts }) => renderCategoryBlock(category, posts))}

        {/* 3. grup kategoriler */}
          {group1Posts.map(({ category, posts }) => renderCategoryBlock(category, posts))}
      </div>
    );
  } catch (error) {
    console.error('Error in CategoryPostsGrid:', error);
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Kategoriler yüklenirken bir hata oluştu.</p>
      </div>
    );
  }
};

export default CategoryPostsGrid;
