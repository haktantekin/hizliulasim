"use client";

import Link from "next/link";
import { act, useMemo } from "react";
import type { BlogCategory } from "@/types/WordPress";

interface CategoryScrollerProps {
  categories: BlogCategory[];
  activeSlug?: string; // highlight current category if provided
  className?: string;
  showCounts?: boolean;
}

export default function CategoryScroller({ categories, activeSlug, className = "", showCounts = false }: CategoryScrollerProps) {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => (b.postCount || 0) - (a.postCount || 0)),
    [categories]
  );

  if (!sorted.length) return null;

  return (
    <div className={`flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide ${className}`}>
      {sorted.map(cat => {
        const active = activeSlug === cat.slug;
        return (
          <Link
            key={cat.id}
            href={`/blog/${cat.slug}`}
            className={`snap-start shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors whitespace-nowrap`}
            title={`${cat.name}${cat.postCount ? ` (${cat.postCount})` : ""}`}
          >
            <span className={`${active ? "!font-medium" : "font-light"}`}>{cat.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
