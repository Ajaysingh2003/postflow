import type { MetadataRoute } from "next";
import { absoluteUrl, PRIVATE_PATHS, SITE_URL } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  return {
    // The wildcard permits search crawlers (including AI search) on public pages.
    // Keep private exclusions in the same group; bot-specific allow-only groups
    // would override them. Training permissions are a separate owner decision.
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS.flatMap((path) => [path, `${path}/`]),
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
