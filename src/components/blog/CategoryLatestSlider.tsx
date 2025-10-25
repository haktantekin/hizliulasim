"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BlogPost } from "@/types/WordPress";

interface Props {
  posts: BlogPost[];
  categorySlug: string;
  title?: string;
}

// Groups posts into pages of 3 and renders a simple scroll-snap carousel with prev/next controls
export default function CategoryLatestSlider({ posts, categorySlug, title = "En Yeni Yazılar" }: Props) {
  const pages = useMemo(() => {
    const chunks: BlogPost[][] = [];
    for (let i = 0; i < posts.length; i += 3) {
      chunks.push(posts.slice(i, i + 3));
    }
    return chunks;
  }, [posts]);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    setPageIndex(0);
  }, [posts.length]);

  const goto = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, pages.length - 1));
    setPageIndex(clamped);
    if (trackRef.current) {
      const width = trackRef.current.clientWidth;
      trackRef.current.scrollTo({ left: width * clamped, behavior: "smooth" });
    }
  };

  if (!posts || posts.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {pages.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => goto(pageIndex - 1)}
              disabled={pageIndex === 0}
              className="px-3 py-1.5 rounded border border-brand-light-blue text-sm disabled:opacity-40"
            >
              ←
            </button>
            <button
              onClick={() => goto(pageIndex + 1)}
              disabled={pageIndex >= pages.length - 1}
              className="px-3 py-1.5 rounded border border-brand-light-blue text-sm disabled:opacity-40"
            >
              →
            </button>
          </div>
        )}
      </div>

      <div ref={trackRef} className="relative overflow-x-auto scroll-smooth snap-x snap-mandatory">
        <div className="flex" style={{ width: `${pages.length * 100}%` }}>
          {pages.map((group, i) => (
            <div key={i} className="snap-start shrink-0 w-full px-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.map((post) => (
                  <Link key={post.id} href={`/blog/${categorySlug}/${post.slug}`} className="border border-brand-light-blue rounded-lg overflow-hidden hover:shadow-sm transition-shadow block">
                    <div className="h-36 bg-gray-100 relative">
                      {post.featuredImage ? (
                        <Image
                          src={post.featuredImage.url}
                          alt={post.featuredImage.alt}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Görsel yok</div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{post.title}</h3>
                      <div className="text-xs text-gray-500">{new Date(post.publishedAt).toLocaleDateString('tr-TR')}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {pages.map((_, i) => (
            <button key={i} onClick={() => goto(i)} className={`h-2 w-2 rounded-full ${i === pageIndex ? 'bg-brand-dark-blue' : 'bg-gray-300'}`} aria-label={`Sayfa ${i + 1}`} />
          ))}
        </div>
      )}
    </section>
  );
}
