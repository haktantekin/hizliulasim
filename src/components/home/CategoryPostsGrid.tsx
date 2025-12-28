import Link from 'next/link';
import { fetchCategories, fetchPosts } from '@/services/wordpress';
import PostListItem from '../blog/PostListItem';

const CategoryPostsGrid = async () => {
  try {
    // Fetch all main categories (those without parent)
    const allCategories = await fetchCategories();
    const mainCategories = allCategories.filter(cat => !cat.parentId);

    // Fetch latest 5 posts for each main category
    const categoryPostsPromises = mainCategories.map(async (category) => {
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

    const categoryPosts = await Promise.all(categoryPostsPromises);

    return (
      <div>
        {categoryPosts.map(({ category, posts }) => {
          if (posts.length === 0) return null;

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
                  href={`/${category.slug}`}
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

                  // If post is in a sub-category, use main/sub format
                  const postMainCategory = postCategory?.parentId
                    ? allCategories.find(c => c.id === postCategory.parentId)
                    : postCategory;

                  const href = postCategory
                    ? postMainCategory && postMainCategory.id !== category.id
                      ? `/${postMainCategory?.slug || category.slug}/${postCategory.slug}/${post.slug}`
                      : `/${category.slug}/${postCategory.slug}/${post.slug}`
                    : `/${category.slug}/#/${post.slug}`;

                  return (
                    <PostListItem
                      key={post.id}
                      post={post}
                      href={href}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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
