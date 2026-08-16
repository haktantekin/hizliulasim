import Image from 'next/image';
import Link from 'next/link';
import { getDummyImageForCategory } from '@/lib/getDummyImage';
import { fetchCategories, fetchPosts } from '@/services/wordpress';

export default async function OfficialOfficesPostsRow() {
  try {
    const categories = await fetchCategories();
    const officialOffices = categories.find(category => category.slug === 'resmi-daireler');

    if (!officialOffices) return null;

    const posts = await fetchPosts({
      categoryId: officialOffices.id,
      per_page: 10,
      page: 1,
      orderby: 'date',
      order: 'desc',
    });

    if (!posts.length) return null;

    const parentCategory = officialOffices.parentId
      ? categories.find(category => category.id === officialOffices.parentId)
      : undefined;
    const categoryHref = parentCategory
      ? `/${parentCategory.slug}/${officialOffices.slug}`
      : `/${officialOffices.slug}`;

    return (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-soft-blue">Resmi Daireler</h2>
          <Link
            href={categoryHref}
            className="text-sm font-medium text-brand-orange transition-opacity hover:opacity-80"
          >
            Tümünü Gör
          </Link>
        </div>

        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {posts.slice(0, 10).map(post => {
            const fallback = getDummyImageForCategory(officialOffices.slug, post.title);
            const imageUrl = post.featuredImage?.url || fallback?.url;
            const imageAlt = post.featuredImage?.alt || fallback?.alt || post.title;

            return (
              <Link
                key={post.id}
                href={`${categoryHref}/${post.slug}`}
                className="min-w-[270px] max-w-[270px] snap-start overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative h-36 w-full bg-gray-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={imageAlt}
                      fill
                      className="object-cover"
                      sizes="270px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      Görsel yok
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-[2.6rem] text-sm font-semibold text-gray-800">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-xs text-gray-400">
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
    console.error('Error in OfficialOfficesPostsRow:', error);
    return null;
  }
}
