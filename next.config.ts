import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cms.hizliulasim.com",
        port: "",
        pathname: "/wp-content/**",
      },
    ],
  },
};

export default nextConfig;
