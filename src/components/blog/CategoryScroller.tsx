"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { BlogCategory } from "@/types/WordPress";

const EMPTY_CATEGORIES: BlogCategory[] = [];

interface CategoryScrollerProps {
  categories: BlogCategory[];
  allCategories?: BlogCategory[];
  activeSlug?: string;
  className?: string;
  showCounts?: boolean;
  mainOnly?: boolean;
}

export default function CategoryScroller({ categories, allCategories = EMPTY_CATEGORIES, activeSlug, className = "", showCounts = false, mainOnly = false }: CategoryScrollerProps) {
  const sorted = useMemo(
    () => {
      const filtered = mainOnly 
        ? categories.filter(cat => !cat.parentId) 
        : categories;
      return [...filtered].sort((a, b) => (b.postCount || 0) - (a.postCount || 0));
    },
    [categories, mainOnly]
  );

  if (!sorted.length) return null;

  return (
    <div className={`flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide ${className}`}>
      {sorted.map(cat => {
        const active = activeSlug === cat.slug;
        // If category has a parent, build hierarchical URL
        const parentCategory = cat.parentId 
          ? allCategories.find(c => c.id === cat.parentId)
          : null;
        const href = parentCategory
          ? `/${parentCategory.slug}/${cat.slug}`
          : `/${cat.slug}`;
        return (
          <Link
            key={cat.id}
            href={href}
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

