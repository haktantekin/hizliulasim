"use client";

import Link from "next/link";
import { useMemo } from "react";
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
            className={`snap-start shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-colors whitespace-nowrap ${
              active
                ? "bg-brand-dark-blue text-white border-dark-blue"
                : "bg-white text-brand-dark-blue border-gray-200 hover:bg-gray-50"
            }`}
            title={`${cat.name}${cat.postCount ? ` (${cat.postCount})` : ""}`}
          >
            <span className="font-medium">{cat.name}</span>
            {showCounts && typeof cat.postCount === 'number' && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${active ? 'border-white/40 bg-white/10' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>{cat.postCount}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
