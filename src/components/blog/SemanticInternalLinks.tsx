import Link from 'next/link';

import type { RankedInternalLink } from '@/lib/internalLinking';
import type { BlogCategory } from '@/types/WordPress';

export default function SemanticInternalLinks({
  links,
  categories,
}: {
  links: RankedInternalLink[];
  categories: BlogCategory[];
}) {
  if (links.length === 0) return null;

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <section className="mt-10" aria-labelledby="semantic-related-content-heading">
      <h2 id="semantic-related-content-heading" className="mb-4 text-xl font-semibold">
        İlgili İçerikler
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map(({ post, href, categoryId }) => (
          <li key={href}>
            <Link
              href={href}
              className="block h-full rounded-lg border border-gray-200 bg-white p-4 text-gray-800 transition-colors hover:border-brand-soft-blue hover:text-brand-soft-blue"
            >
              <span className="font-semibold leading-snug">{post.title}</span>
              {categoryNames.get(categoryId) && (
                <span className="mt-1 block text-xs text-gray-500">
                  {categoryNames.get(categoryId)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
