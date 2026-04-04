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
  hideImage?: boolean;
}

export default function PostListItem({ post, href, className = "", categorySlug, categoryName, hideImage }: Props) {
  // Resim yoksa kategori bazlı dummy resim kontrolü
  const dummyImage = !post.featuredImage && categorySlug
    ? getDummyImageForCategory(categorySlug, post.title)
    : null;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-3 relative border-b border-brand-light-blue pb-5 last:border-0 ${className}`}
    >
      {!hideImage && (
       <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }} className="bg-gray-100 rounded-md overflow-hidden">
        {post.featuredImage ? (
          <Image
            src={post.featuredImage.url}
            alt={post.featuredImage.alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : dummyImage ? (
          <Image
            src={dummyImage.url}
            alt={dummyImage.alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Görsel yok</div>
        )}
      </div>
      )}
      <div className="flex flex-col mr-auto">
        {categoryName && <div className="text-xs text-brand-orange font-medium">{categoryName}</div>}
        <h3 className="font-medium line-clamp-2 my-1 text-base leading-[20px]">{post.title}</h3>
        {post.excerpt && (
          <p className="text-xs font-light text-gray-400 line-clamp-3">{post.excerpt}</p>
        )}
        <div className="text-xs text-gray-400 font-light mt-1">
          {new Date(post.publishedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
     
    </Link>
  );
}
