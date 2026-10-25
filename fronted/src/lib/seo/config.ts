import type { Metadata } from "next";

export const SITE_URL = "https://draftva.com";
export const SITE_NAME = "Draftva";

export const SEO_PAGES = {
  "/": {
    title: "AI Post Writer & Scheduler for X & LinkedIn | Draftva",
    description:
      "Write posts in your own voice with AI, then schedule them to X, LinkedIn and Threads from one workspace. Grow your personal brand. Start free.",
    label: "Home",
    image: "home",
    keyword: "AI social post writer and scheduler",
  },
  "/pricing": {
    title: "Pricing & Plans for AI Social Post Scheduling | Draftva",
    description:
      "Compare Draftva plans for AI post writing, scheduling and brand voices. Start on Free and upgrade as your workflow grows. See pricing.",
    label: "Pricing",
    image: "pricing",
    keyword: "social media scheduling pricing",
  },
  "/about": {
    title: "About Draftva: Simpler Social Writing & Scheduling",
    description:
      "Draftva exists to make writing and scheduling social posts simpler. Learn who is behind it and the ideas that shape the product.",
    label: "About",
    image: "about",
    keyword: "about Draftva",
  },
  "/product/ai-writer": {
    title: "AI Post Writer for X, LinkedIn & Threads | Draftva",
    description:
      "Turn rough ideas into ready-to-post drafts for X, LinkedIn and Threads. Refine the tone until it sounds like you. Start free.",
    label: "AI post writer",
    image: "ai-writer",
    keyword: "AI post writer",
  },
  "/product/schedule": {
    title: "Social Media Post Scheduler for X & LinkedIn | Draftva",
    description:
      "Plan, queue and schedule posts for X, LinkedIn and Threads from one calendar. Stay consistent without juggling tabs. Start free.",
    label: "Post scheduler",
    image: "schedule",
    keyword: "social media post scheduler",
  },
  "/product/analytics": {
    title: "Social Media Post Analytics & Insights | Draftva",
    description:
      "See how your posts perform across connected accounts. Spot what works, then plan your next post with Draftva analytics. Explore features.",
    label: "Post analytics",
    image: "analytics",
    keyword: "social media post analytics",
  },
  "/product/social-integration": {
    title: "X, LinkedIn & Threads Integrations | Draftva",
    description:
      "Connect your X, LinkedIn and Threads accounts to write and schedule from one workspace. See how Draftva integrations work.",
    label: "Social integrations",
    image: "integrations",
    keyword: "social media account integrations",
  },
  "/product/mcp": {
    title: "MCP Server for Social Post Scheduling | Draftva",
    description:
      "Connect AI assistants to Draftva through MCP. Create drafts and manage your publishing workflow without leaving your assistant. See setup.",
    label: "MCP integration",
    image: "mcp",
    keyword: "MCP social media scheduling",
  },
  "/legal": {
    title: "Legal Center: Terms, Privacy & Policies | Draftva",
    description:
      "Find Draftva's terms of service, privacy policy, cookie policy, acceptable use policy and data processing documents in one place.",
    label: "Legal",
    image: "legal",
    keyword: "Draftva legal policies",
  },
  "/terms": {
    title: "Terms of Service | Draftva",
    description:
      "Read Draftva's terms of service covering accounts, subscriptions, content ownership and acceptable platform use.",
    label: "Terms of service",
    image: "terms",
    keyword: "Draftva terms of service",
  },
  "/privacy": {
    title: "Privacy Policy | Draftva",
    description:
      "Learn how Draftva collects, uses and protects personal data and connected social account information. Read the full privacy policy.",
    label: "Privacy policy",
    image: "privacy",
    keyword: "Draftva privacy policy",
  },
  "/cookies": {
    title: "Cookie Policy | Draftva",
    description:
      "See which cookies and local storage Draftva uses for sessions and preferences, and how to manage your cookie choices.",
    label: "Cookie policy",
    image: "cookies",
    keyword: "Draftva cookie policy",
  },
  "/acceptable-use": {
    title: "Acceptable Use Policy | Draftva",
    description:
      "Draftva's rules for responsible publishing, including limits on spam, scraping and platform manipulation. Read the acceptable use policy.",
    label: "Acceptable use",
    image: "acceptable-use",
    keyword: "Draftva acceptable use policy",
  },
  "/dpa": {
    title: "Data Processing Addendum (DPA) | Draftva",
    description:
      "Read Draftva's data processing addendum covering processor responsibilities, security safeguards and who to contact about data processing.",
    label: "Data processing addendum",
    image: "dpa",
    keyword: "Draftva data processing addendum",
  },
  "/subprocessors": {
    title: "Sub-processors Directory | Draftva",
    description:
      "See the third-party service providers Draftva uses to process data, what each one does, and how to raise data protection questions.",
    label: "Sub-processors",
    image: "subprocessors",
    keyword: "Draftva sub-processors",
  },
} as const;
export type MarketingPath = keyof typeof SEO_PAGES;

export const LEGAL_REDIRECTS: Record<string, MarketingPath> = {
  "/terms-of-service": "/terms",
  "/privacy-policy": "/privacy",
  "/cookie-policy": "/cookies",
  "/sub-processors": "/subprocessors",
};

export const PRIVATE_PATHS = [
  "/dashboard",
  "/settings",
  "/app",
  "/auth",
  "/api",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-otp",
  "/invitations",
  "/onboarding",
];
export function isPrivatePath(path: string) {
  return PRIVATE_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}
export function seoMetadata(path: MarketingPath): Metadata {
  const page = SEO_PAGES[path];
  const url = absoluteUrl(path);
  const image = {
    url: absoluteUrl(`/images/og/${page.image}.png`),
    width: 1200,
    height: 630,
    alt: page.title,
  };
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: page.title,
      description: page.description,
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [image.url],
    },
  };
}
export const PRIVATE_METADATA: Metadata = {
  title: { absolute: "Your workspace | Draftva" },
  description: "Sign in to manage your Draftva workspace.",
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
  alternates: { canonical: null },
};
