import Image from 'next/image';
import Link from 'next/link';
import { fetchCategories, fetchPosts } from '@/services/wordpress';
import { getDummyImageForCategory } from '@/lib/getDummyImage';

function buildPostHref(
  postSlug: string,
  categoryId: number | undefined,
  categoryMap: Map<number, { slug: string; parentId?: number }>
): string {
  if (!categoryId) return '#';

  const category = categoryMap.get(categoryId);
  if (!category) return '#';

  if (category.parentId) {
    const parent = categoryMap.get(category.parentId);
    if (parent) {
      return `/${parent.slug}/${category.slug}/${postSlug}`;
    }
  }

  return `/${category.slug}/${postSlug}`;
}

export default async function LatestPostsRow() {
  try {
    const categories = await fetchCategories();
    const ulasimRehberi = categories.find(c => c.slug === 'ulasim-rehberi');

    if (!ulasimRehberi) return null;

    const ulasimCategoryIds = [
      ulasimRehberi.id,
      ...categories.filter(c => c.parentId === ulasimRehberi.id).map(c => c.id),
    ];

    const postsByCategory = await Promise.all(
      ulasimCategoryIds.map(categoryId =>
        fetchPosts({
          categoryId,
          per_page: 10,
          page: 1,
          orderby: 'date',
          order: 'desc',
        })
      )
    );

    const posts = Array.from(
      new Map(postsByCategory.flat().map(post => [post.id, post])).values()
    )
      .sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      )
      .slice(0, 10);

    if (!posts.length) return null;

    const categoryMap = new Map(
      categories.map(c => [c.id, { slug: c.slug, parentId: c.parentId }])
    );

    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-brand-soft-blue">Son 10 Yazı</h2>
          <Link
            href="/ulasim-rehberi"
            className="text-sm font-medium text-brand-orange hover:opacity-80 transition-opacity"
          >
            Tumunu Gor
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {posts.map(post => {
            const categoryId = post.categoryIds?.[0];
            const category = categoryId ? categoryMap.get(categoryId) : undefined;
            const href = buildPostHref(post.slug, categoryId, categoryMap);
            const fallbackImage = getDummyImageForCategory(category?.slug, post.title);
            const imageUrl = post.featuredImage?.url || fallbackImage?.url;
            const imageAlt = post.featuredImage?.alt || fallbackImage?.alt || post.title;

            return (
              <Link
                key={post.id}
                href={href}
                className="min-w-[270px] max-w-[270px] snap-start rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative w-full h-36 bg-gray-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={imageAlt}
                      fill
                      className="object-cover"
                      sizes="270px"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                      Gorsel yok
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 min-h-[2.6rem]">
                    {post.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(post.publishedAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    );
  } catch (error) {
    console.error('Error in LatestPostsRow:', error);
    return null;
  }
}
