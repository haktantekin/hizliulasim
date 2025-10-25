import Link from "next/link";
import { fetchRecentPostsByCategory } from "@/services/wordpress";
import PostListItem from "@/components/blog/PostListItem";

export default async function HowToGoRecent() {
  // Category ID 2 -> "Nasıl Giderim" (as established in services)
  const items = await fetchRecentPostsByCategory(2, 6);

  if (!items?.length) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-brand-dark-blue">Nasıl Giderim?</h2>
        <Link href="/blog/nasil-giderim" className="text-sm text-brand-orange hover:underline">Hepsini gör</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((post) => (
          <PostListItem key={post.id} post={post} href={`/blog/nasil-giderim/${post.slug}`} />
        ))}
      </div>
    </section>
  );
}
