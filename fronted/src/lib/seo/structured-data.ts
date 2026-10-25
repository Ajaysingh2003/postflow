import {
  absoluteUrl,
  SEO_PAGES,
  SITE_NAME,
  SITE_URL,
  type MarketingPath,
} from "./config";
import { answerPage } from "./answers";
import type { BillingConfigResponse } from "@/modules/types";
import { PRICING_FAQS } from "@/modules/billing/pricing-faqs";

export const ENTITY_IDS = {
  organization: `${SITE_URL}/#organization`,
  website: `${SITE_URL}/#website`,
  software: `${SITE_URL}/#software`,
} as const;

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
    "@id": ENTITY_IDS.software,
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: answerPage("/")!.summary,
    publisher: { "@id": ENTITY_IDS.organization },
    mainEntityOfPage: { "@id": `${absoluteUrl("/")}#webpage` },
    inLanguage: "en",
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

/** Questions and answers are the exact same strings rendered on the page. */
export function pageQuestions(path: MarketingPath) {
  if (path === "/pricing")
    return PRICING_FAQS.flatMap((faq, index) =>
      faq.includeInSchema ? [{ ...faq, id: `pricing-faq-${index}` }] : [],
    );
  return answerPage(path)?.questions ?? [];
}

export function pageStructuredData(
  path: MarketingPath,
  plans?: BillingConfigResponse,
) {
  const url = absoluteUrl(path);
  const pageId = `${url}#webpage`;
  const productPage =
    path === "/" || path === "/pricing" || path.startsWith("/product/");
  const questions = pageQuestions(path);
  const faqId = `${url}#${path === "/pricing" ? "faqs" : "questions"}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": ENTITY_IDS.organization,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/images/brand/draftva-logo.jpg"),
      },
      // TODO: Add sameAs only after the owner supplies verified public brand URLs.
    },
    {
      "@type": "WebSite",
      "@id": ENTITY_IDS.website,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": ENTITY_IDS.organization },
      inLanguage: "en",
    },
    {
      "@type": path === "/about" ? "AboutPage" : "WebPage",
      "@id": pageId,
      url,
      name: SEO_PAGES[path].title,
      description: answerPage(path)?.summary ?? SEO_PAGES[path].description,
      isPartOf: { "@id": ENTITY_IDS.website },
      publisher: { "@id": ENTITY_IDS.organization },
      about: {
        "@id": productPage ? ENTITY_IDS.software : ENTITY_IDS.organization,
      },
      inLanguage: "en",
      ...(path !== "/" ? { breadcrumb: { "@id": `${url}#breadcrumbs` } } : {}),
      ...(questions.length ? { hasPart: { "@id": faqId } } : {}),
    },
  ];
  if (productPage) graph.push(applicationSchema(plans));
  if (questions.length)
    graph.push({
      "@type": "FAQPage",
      "@id": faqId,
      isPartOf: { "@id": pageId },
      inLanguage: "en",
      mainEntity: questions.map((faq) => ({
        "@type": "Question",
        "@id": `${url}#${faq.id}`,
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  if (path !== "/")
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: breadcrumbItems(path).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })),
    });
  return { "@context": "https://schema.org", "@graph": graph };
}
