import { NextRequest, NextResponse } from "next/server";

export const revalidate = 3600; // 1 hour

type WpPost = {
  id: number;
  date: string;
  link: string;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  _embedded?: {
    [key: string]: unknown;
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: {
          [key: string]: { source_url?: string };
        };
      };
    }>;
  };
};

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function decodeHtml(input: string): string {
  // Decode numeric entities (decimal and hex)
  let s = input.replace(/&#(x?)([0-9a-fA-F]+);/g, (_, hex: string, code: string) => {
    const cp = hex ? parseInt(code, 16) : parseInt(code, 10);
    if (!Number.isFinite(cp)) return _ as string;
    try {
      return String.fromCharCode(cp);
    } catch {
      return _ as string;
    }
  });
  // Decode common named entities
  s = s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
  return s;
}

function getBase() {
  const envBase = process.env.WORDPRESS_API_BASE?.replace(/\/$/, "");
  return envBase || "https://cms.hizliulasim.com/wp-json/wp/v2";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryIdParam = searchParams.get("categoryId");
  const categoriesParam = searchParams.get("categories");
  const limitParam = searchParams.get("limit");
  const perPageParam = searchParams.get("per_page");

  const cidRaw = categoriesParam ?? categoryIdParam ?? "";
  const categoryId = parseInt(cidRaw, 10);
  const limitRaw = perPageParam ?? limitParam ?? "5";
  const limit = Math.max(1, Math.min(20, parseInt(limitRaw, 10)));

  const base = getBase();
  const url = new URL(`${base}/posts`);
  if (!Number.isNaN(categoryId)) url.searchParams.set("categories", String(categoryId));
  url.searchParams.set("per_page", String(limit));
  // Use embed to get featured media; some sites require _embed rather than _fields for media
  url.searchParams.set("_embed", "1");
  url.searchParams.set("orderby", "date");
  url.searchParams.set("order", "desc");

  const res = await fetch(url.toString(), { next: { revalidate } });
  if (!res.ok) {
    return NextResponse.json({ items: [], error: `WP error ${res.status}` }, { status: 200 });
  }
  const posts = (await res.json()) as WpPost[];
  const items = posts.map((p) => {
    let imageUrl: string | undefined;
    const media = p._embedded?.["wp:featuredmedia"]?.[0];
    if (media) {
      imageUrl = media.source_url || media.media_details?.sizes?.medium?.source_url || media.media_details?.sizes?.thumbnail?.source_url;
    }
    const rawTitle = p.title?.rendered ?? "";
    const rawExcerpt = p.excerpt?.rendered ?? "";
    const title = decodeHtml(stripTags(rawTitle));
    const excerpt = decodeHtml(stripTags(rawExcerpt)) || undefined;
    return {
      id: String(p.id),
      title,
      slug: p.slug,
      excerpt,
      date: p.date,
      url: p.link,
      imageUrl,
    };
  });
  return NextResponse.json({ items });
}
