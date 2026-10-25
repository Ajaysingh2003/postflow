import { LEGAL_REDIRECTS, SITE_URL } from "./config";

// Preserve previously published image URLs when adopting descriptive filenames.
const ASSET_REDIRECTS: Record<string, string> = {
  "/logo.jpg": "/images/brand/draftva-logo.jpg",
  "/founder.png": "/images/about/about-founder-ajay-singh.png",
  "/footer_banner_2.png": "/images/product/social-scheduler-banner.png",
  "/dashboard/home.png": "/images/product/home-dashboard-preview.png",
  "/dashboard/channels.png": "/images/product/channels-dashboard-preview.png",
  "/dashboard/content.png": "/images/product/content-dashboard-preview.png",
  "/dashboard/schedule.png": "/images/product/schedule-dashboard-preview.png",
  "/dashboard/analytics.png": "/images/product/analytics-dashboard-preview.png",
};

/** One hop combines host, HTTPS, slash and legal-alias normalization. */
export function canonicalRedirect(
  input: string,
  host?: string | null,
  forwardedProtocol?: string | null,
) {
  const url = new URL(input);
  const hostname = (host ?? url.host).split(":")[0].toLowerCase();
  const productionHost =
    hostname === "draftva.com" || hostname === "www.draftva.com";
  const protocol =
    forwardedProtocol?.split(",")[0].trim() ?? url.protocol.replace(":", "");
  const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/+$/, "");
  const targetPath = LEGAL_REDIRECTS[path] ?? ASSET_REDIRECTS[path] ?? path;
  if (
    targetPath === url.pathname &&
    !(productionHost && (hostname.startsWith("www.") || protocol !== "https"))
  )
    return null;
  const target = new URL(productionHost ? SITE_URL : url.origin);
  target.pathname = targetPath;
  target.search = url.search;
  return target.toString();
}
