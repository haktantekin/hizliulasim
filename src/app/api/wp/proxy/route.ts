import { NextRequest, NextResponse } from "next/server";
import {
  fetchWordPressProxyPayload,
  WordPressProxyHttpError,
} from "@/lib/wordpressProxy";

const WP_API_BASE =
  process.env.NEXT_PUBLIC_WP_API_URL ||
  "https://cms.hizliulasim.com/wp-json/wp/v2";
const EDGE_CACHE_SECONDS = 300;
const EDGE_STALE_SECONDS = 3600;

/**
 * Transparent proxy for WordPress REST API requests.
 * Forwards all query parameters to the WP API and returns the raw JSON
 * response along with pagination headers (X-WP-Total, X-WP-TotalPages).
 *
 * Usage: GET /api/wp/proxy?endpoint=posts&categories=5&per_page=20&page=2
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // "endpoint" decides which WP resource to hit (default: posts)
  const endpoint = searchParams.get("endpoint") || "posts";
  searchParams.delete("endpoint");

  // Allowlist of safe WP query parameters to forward
  const ALLOWED_PARAMS = new Set([
    "categories",
    "per_page",
    "page",
    "hide_empty",
    "search",
    "orderby",
    "order",
    "_embed",
    "slug",
    "_fields",
    "include",
    "exclude",
    "tags",
    "author",
    "status",
    "offset",
  ]);

  const wpUrl = new URL(`${WP_API_BASE}/${encodeURIComponent(endpoint)}`);
  for (const [key, value] of searchParams.entries()) {
    if (ALLOWED_PARAMS.has(key)) {
      wpUrl.searchParams.set(key, value);
    }
  }

  try {
    const { data, total, totalPages } = await fetchWordPressProxyPayload(wpUrl.toString());

    const response = NextResponse.json(data);

    // Forward WP pagination headers so the client can determine hasNextPage
    if (total) response.headers.set("X-WP-Total", total);
    if (totalPages) response.headers.set("X-WP-TotalPages", totalPages);
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${EDGE_CACHE_SECONDS}, stale-while-revalidate=${EDGE_STALE_SECONDS}`
    );

    return response;
  } catch (err) {
    if (err instanceof WordPressProxyHttpError) {
      return NextResponse.json(
        { error: `WordPress API error: ${err.status}` },
        { status: err.status },
      );
    }
    console.error("WP proxy error:", err);
    return NextResponse.json(
      { error: "WordPress API isteği başarısız oldu" },
      { status: 502 }
    );
  }
}
