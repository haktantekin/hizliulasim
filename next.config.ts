import type { NextConfig } from "next";
import { loadRedirectManifestWithFallback } from "./src/lib/redirectManifest";
import { hasLegacyContentSegment } from "./src/lib/legacyContentPaths";
import { BROKEN_DURAK_SLUGS, BROKEN_HAT_SLUGS } from "./src/broken-redirects";
import redirectSnapshot from "./src/data/redirects.snapshot.json";

const nextConfig: NextConfig = {
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cms.hizliulasim.com",
        port: "",
        pathname: "/wp-content/**",
      },
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
        port: "",
        pathname: "/maps/api/place/photo",
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
  },
  experimental: {
    turbopackChunking: {
      generateComponentChunks: true,
      priorityRoutes: [
        /^\/$/,
        /^\/ulasim-rehberi(?:\/|$)/,
      ],
    },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Resolve ordinary CMS-managed redirects at build time so page requests do not boot WordPress.
  async redirects() {
    const {
      manifest,
      usedFallback,
      refreshError,
    } = await loadRedirectManifestWithFallback({
      fallbackPayload: redirectSnapshot,
      minimumRules: 100,
    });
    if (usedFallback) {
      console.warn(
        `CMS redirect manifest could not be refreshed; using ${manifest.length} checked-in rules.`,
        refreshError,
      );
    }

    // Legacy and generated broken-route rules keep their existing middleware behavior.
    const redirects = manifest
      .filter((rule) => {
        if (hasLegacyContentSegment(rule.source)) return false;

        const stopMatch = rule.source.match(/^\/otobus-duraklari\/([^/]+)$/);
        if (stopMatch && BROKEN_DURAK_SLUGS.has(stopMatch[1])) return false;

        const routeMatch = rule.source.match(/^\/otobus-hatlari\/([^/]+)$/);
        if (routeMatch && BROKEN_HAT_SLUGS.has(routeMatch[1])) return false;

        return true;
      });
    if (redirects.length > 2048) {
      throw new Error(`CMS redirect count (${redirects.length}) exceeds Vercel's 2048 static rule limit`);
    }
    return redirects;
  },
  // Security and performance headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      // Cache static assets
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
