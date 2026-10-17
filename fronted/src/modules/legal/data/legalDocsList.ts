import {
  FileText,
  ShieldCheck,
  Cookie,
  AlertTriangle,
  Database,
  Server,
  Lock,
  CheckCircle2,
  Share2,
  Sparkles,
} from "lucide-react";
import type { LegalDocMeta } from "../types";

export const LEGAL_DOCS: LegalDocMeta[] = [
  {
    id: "terms",
    title: "Terms of Service",
    shortTitle: "Terms",
    slug: "/terms",
    lastUpdated: "October 16, 2026",
    effectiveDate: "October 16, 2026",
    version: "2.4",
    readTime: "12 min read",
    description:
      "The terms governing your access to and use of Draftva's multi-channel social media scheduling, content composition, and AI writing platform.",
    summaries: [
      {
        icon: ShieldCheck,
        title: "You Own Your Content",
        description:
          "You retain 100% intellectual property ownership of all posts, media, ideas, and drafts you create or schedule on Draftva.",
      },
      {
        icon: Lock,
        title: "Official APIs Only",
        description:
          "Draftva operates strictly via official partner and developer OAuth APIs. We never ask for or store your social account passwords.",
      },
      {
        icon: Sparkles,
        title: "AI Writing Assistant",
        description:
          "Our AI tools assist your writing. Your private prompts and brand voice samples are never used to train public foundation models without your explicit consent.",
      },
      {
        icon: CheckCircle2,
        title: "Transparent Subscriptions",
        description:
          "Enjoy a 3-day free trial with no surprises. Cancel anytime from your account settings with instant confirmation.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    slug: "/privacy",
    lastUpdated: "October 16, 2026",
    effectiveDate: "October 16, 2026",
    version: "2.4",
    readTime: "14 min read",
    description:
      "A comprehensive explanation of how Draftva collects, protects, uses, and respects personal data and OAuth credentials across all connected channels.",
    summaries: [
      {
        icon: Lock,
        title: "Encrypted Tokens",
        description:
          "All social media OAuth tokens are encrypted at rest using industry-standard AES-256 and transmitted exclusively over TLS 1.3.",
      },
      {
        icon: ShieldCheck,
        title: "We Never Sell Data",
        description:
          "Draftva never sells, rents, or trades your personal information, contact lists, or social analytics to third-party data brokers.",
      },
      {
        icon: CheckCircle2,
        title: "GDPR & CCPA Compliant",
        description:
          "Full support for data access, rectification, portability, and right-to-be-forgotten requests. Easily export or delete your workspace anytime.",
      },
      {
        icon: Sparkles,
        title: "Enterprise AI Security",
        description:
          "All AI generation happens through enterprise agreements with zero-data-retention policies for model training.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookie Policy",
    shortTitle: "Cookies",
    slug: "/cookies",
    lastUpdated: "October 16, 2026",
    effectiveDate: "October 16, 2026",
    version: "2.1",
    readTime: "7 min read",
    description:
      "Details on the cookies and local storage technologies Draftva utilizes for session authentication, security, preferences, and platform performance.",
    summaries: [
      {
        icon: Cookie,
        title: "Essential For Security",
        description:
          "We use strictly necessary cookies to keep you signed in securely, maintain session state, and protect against CSRF attacks.",
      },
      {
        icon: Lock,
        title: "No Third-Party Ad Trackers",
        description:
          "Draftva does not run invasive third-party ad retargeting networks across our authenticated web app.",
      },
      {
        icon: CheckCircle2,
        title: "Granular Control",
        description:
          "You can manage cookie settings through your browser preferences or our cookie management controls at any time.",
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use Policy",
    shortTitle: "Acceptable Use",
    slug: "/acceptable-use",
    lastUpdated: "October 16, 2026",
    effectiveDate: "October 16, 2026",
    version: "2.3",
    readTime: "9 min read",
    description:
      "Standards of conduct and content guidelines to keep Draftva and connected social communities safe, spam-free, and respectful.",
    summaries: [
      {
        icon: AlertTriangle,
        title: "Strict Anti-Spam",
        description:
          "No automated vote manipulation, auto-commenting, mass scraping, or identical cross-posting spam across Reddit, X, or LinkedIn.",
      },
      {
        icon: ShieldCheck,
        title: "Authentic Engagement",
        description:
          "Draftva is built for genuine creators and brands. We prohibit coordinated inauthentic behavior, bots, and deceptive automation.",
      },
      {
        icon: Lock,
        title: "Respect Platform APIs",
        description:
          "All users must honor official platform terms (X Developer Policy, Reddit API Terms, Meta Platform Terms, LinkedIn Policies).",
      },
    ],
  },
  {
    id: "dpa",
    title: "Data Processing Addendum (DPA)",
    shortTitle: "DPA",
    slug: "/dpa",
    lastUpdated: "October 16, 2026",
    effectiveDate: "October 16, 2026",
    version: "2.2",
    readTime: "11 min read",
    description:
      "Our contractual commitment under GDPR Article 28 and privacy laws governing the processing of personal data on behalf of your workspace.",
    summaries: [
      {
        icon: Database,
        title: "Processor Obligations",
        description:
          "Draftva acts strictly as a Data Processor under your instructions as the Data Controller.",
      },
      {
        icon: Lock,
        title: "Rigorous TOMs",
        description:
          "State-of-the-art Technical and Organizational Measures including end-to-end encryption, role-based access, and vulnerability audits.",
      },
      {
        icon: CheckCircle2,
        title: "Standard Contractual Clauses",
        description:
          "Includes approved EU Standard Contractual Clauses (SCCs) and UK Addendum to safeguard international cross-border data transfers.",
      },
    ],
  },
  {
    id: "subprocessors",
    title: "Sub-processors Directory",
    shortTitle: "Sub-processors",
    slug: "/subprocessors",
    lastUpdated: "October 16, 2026",
    effectiveDate: "October 16, 2026",
    version: "2.4",
    readTime: "6 min read",
    description:
      "A transparent, up-to-date listing of third-party infrastructure, AI vendors, and payment processors utilized by Draftva.",
    summaries: [
      {
        icon: Server,
        title: "Vetted Infrastructure",
        description:
          "Every vendor undergoes rigorous compliance assessments, SOC 2 / ISO 27001 validation, and executes comprehensive DPAs.",
      },
      {
        icon: Sparkles,
        title: "AI Zero-Retention APIs",
        description:
          "Our AI inference providers process user prompts via enterprise privacy contracts with zero retention for public model training.",
      },
      {
        icon: ShieldCheck,
        title: "Proactive Notification",
        description:
          "Customers can subscribe to receive 30-day advance notifications prior to the engagement of any new sub-processor.",
      },
    ],
  },
];
