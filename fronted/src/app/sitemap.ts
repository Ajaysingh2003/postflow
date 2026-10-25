import type { MetadataRoute } from "next";
import routes from "@/lib/seo/routes.generated.json";
import { absoluteUrl } from "@/lib/seo/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: route.lastModified,
  }));
}
