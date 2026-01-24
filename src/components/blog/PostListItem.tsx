"use client";

import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "@/types/WordPress";
import { getDummyImageForCategory } from "@/lib/getDummyImage";

interface Props {
  post: BlogPost;
  href: string;
  className?: string;
  categorySlug?: string;
  categoryName?: string;
}

export default function PostListItem({ post, href, className = "", categorySlug, categoryName }: Props) {
  // Resim yoksa kategori bazlı dummy resim kontrolü
  const dummyImage = !post.featuredImage && categorySlug
    ? getDummyImageForCategory(categorySlug, post.title)
    : null;
  return (
    <Link
      href={href}
      className={`flex items-start gap-3 relative justify-between border-b border-brand-light-blue pb-5 last:border-0 ${className}`}
    >
       <div className="relative bg-gray-100 rounded-md overflow-hidden flex-none w-28 h-28 md:w-32 md:h-32">
        {post.featuredImage ? (
          <Image
            src={post.featuredImage.url}
            alt={post.featuredImage.alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 112px, 128px"
          />
        ) : dummyImage ? (
          <Image
            src={dummyImage.url}
            alt={dummyImage.alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 112px, 128px"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Görsel yok</div>
        )}
      </div>
      <div className="flex flex-col mr-auto">
        <div className="text-xs text-gray-400 font-light">{new Date(post.publishedAt).toLocaleDateString('tr-TR')}</div>
        <h3 className="font-medium line-clamp-2 my-1 text-base leading-[20px]">{post.title}</h3>
        {post.excerpt && (
          <p className="text-xs font-light text-gray-400 line-clamp-3">{post.excerpt}</p>
        )}
      </div>
     
    </Link>
  );
}
