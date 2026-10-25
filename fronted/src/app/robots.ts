import type { MetadataRoute } from "next";
import { absoluteUrl, PRIVATE_PATHS, SITE_URL } from "@/lib/seo/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS.flatMap((path) => [path, `${path}/`]),
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
