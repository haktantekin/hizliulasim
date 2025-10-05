import { NextRequest, NextResponse } from "next/server";
import { blogs, BlogPost } from "@/data/blogs";

export const revalidate = 60 * 60; // 1 hour cache for the list

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "nasıl giderim").toLowerCase();
  const categoryIdParam = searchParams.get("categoryId");
  const limit = Math.max(1, Math.min(20, parseInt(searchParams.get("limit") || "5", 10)));

  let list: BlogPost[] = blogs.slice();
  if (categoryIdParam) {
    const cid = parseInt(categoryIdParam, 10);
    if (!Number.isNaN(cid)) {
      list = list.filter((b) => b.categoryId === cid);
    }
  } else {
    list = list.filter((b) => (b.category || "").toLowerCase() === category);
  }

  const filtered = list
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  return NextResponse.json({ items: filtered });
}
