"use client";

import Link from "next/link";
import React from "react";

export type Crumb = {
  label: string;
  href?: string;
};

interface Props {
  items: Crumb[];
  className?: string;
}

// Renders: Ana Sayfa / ...items
export default function Breadcrumb({ items, className = "" }: Props) {
  const crumbs: Crumb[] = [{ label: "Ana Sayfa", href: "/" }, ...items];
  return (
    <nav className={`flex items-center text-xs text-gray-600 ${className}`} aria-label="Breadcrumb">
      {crumbs.map((c, idx) => (
        <React.Fragment key={`${c.label}-${idx}`}>
          {idx > 0 && <span className="mx-2">/</span>}
          {c.href ? (
            <Link href={c.href} className="hover:text-brand-soft-blue">
              {c.label}
            </Link>
          ) : (
            <span className="text-gray-900">{c.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
