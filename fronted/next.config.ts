import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support isolated local preview sessions without changing production origins.
  allowedDevOrigins: ["127.0.0.1"],
  reactCompiler: true,
  trailingSlash: false,
  // The proxy combines canonical redirects to avoid multi-hop chains.
  skipTrailingSlashRedirect: true,
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
