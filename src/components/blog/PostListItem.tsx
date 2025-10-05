"use client";

import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "@/types/WordPress";

interface Props {
  post: BlogPost;
  href: string;
  className?: string;
}

export default function PostListItem({ post, href, className = "" }: Props) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-3 relative justify-between border-b border-gray-200 pb-5 last:border-0 ${className}`}
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
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Görsel yok</div>
        )}
      </div>
      <div className="flex flex-col mr-auto">
        <div className="text-xs text-gray-500">{new Date(post.publishedAt).toLocaleDateString('tr-TR')}</div>
        <h3 className="font-bold line-clamp-2 my-1 text-base">{post.title}</h3>
        {post.excerpt && (
          <p className="text-sm font-light text-gray-400 line-clamp-3">{post.excerpt}</p>
        )}
      </div>
     
    </Link>
  );
}
