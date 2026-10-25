import {
  absoluteUrl,
  SEO_PAGES,
  SITE_NAME,
  SITE_URL,
  type MarketingPath,
} from "./config";
import type { BillingConfigResponse } from "@/modules/types";
import { PRICING_FAQS } from "@/modules/billing/pricing-faqs";

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function applicationSchema(plans?: BillingConfigResponse) {
  // Never publish fallback prices or unverified reviews/ratings in schema.
  const offers = Object.values(plans ?? {}).flatMap((plan) => {
    const price = plan.billing_cycles.monthly;
    if (
      !Number.isFinite(price.amount) ||
      price.amount < 0 ||
      !/^[A-Z]{3}$/.test(price.currency ?? "")
    )
      return [];
    return [
      {
        "@type": "Offer",
        name: `${plan.name} — monthly`,
        price: price.amount,
        priceCurrency: price.currency,
        url: absoluteUrl("/pricing"),
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: price.amount,
          priceCurrency: price.currency,
          billingDuration: "P1M",
        },
      },
    ];
  });
  return {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SEO_PAGES["/"].description,
    ...(offers.length ? { offers } : {}),
    // TODO: Add authentic ratings only after obtaining verifiable reviews and permission.
  };
}
export function breadcrumbItems(path: MarketingPath) {
  if (path === "/") return [];
  return [
    { name: "Home", path: "/" as MarketingPath },
    ...(path !== "/legal" &&
    !path.startsWith("/product/") &&
    path !== "/about" &&
    path !== "/pricing"
      ? [{ name: "Legal", path: "/legal" as MarketingPath }]
      : []),
    { name: SEO_PAGES[path].label, path },
  ];
}
export function pageStructuredData(
  path: MarketingPath,
  plans?: BillingConfigResponse,
) {
  const graph: Record<string, unknown>[] = [];
  if (path === "/") {
    graph.push({
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/images/brand/draftva-logo.jpg"),
      },
    });
    graph.push({
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    });
    graph.push(applicationSchema(plans));
  }
  if (path === "/pricing") {
    if (plans) graph.push(applicationSchema(plans));
    graph.push({
      "@type": "FAQPage",
      "@id": `${absoluteUrl(path)}#faqs`,
      mainEntity: PRICING_FAQS.filter((faq) => faq.includeInSchema).map(
        (faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        }),
      ),
    });
  }
  if (path !== "/")
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems(path).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}
