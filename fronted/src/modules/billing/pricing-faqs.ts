export interface FaqItem {
  question: string;
  answer: string;
  includeInSchema: boolean;
}

export const PRICING_FAQS: FaqItem[] = [
  {
    includeInSchema: true,
    question: "Is there a free plan?",
    answer:
      "Yes. Free includes 20 AI credits per month, 5 posts per month and 2 connected accounts, with no trial deadline. Paid plans start at checkout and include unlimited posts, more AI credits and custom brand voice profiles.",
  },
  {
    includeInSchema: true,
    question: "Is post scheduling truly unlimited on all paid plans?",
    answer:
      "Yes! Unlike traditional tools that cap your calendar or charge extra when your queue grows, every paid Draftva plan includes unlimited scheduled and published posts. Batch and plan as many weeks or months in advance as you want across all your connected channels.",
  },
  {
    includeInSchema: true,
    question: "What are AI credits and how are they counted?",
    answer:
      "AI credits power Draftva's intelligent assistant features—including viral hook generation, tone adjustments, thread expansion, and carousel copy synthesis. One AI credit typically refines or generates one complete post variant. If you ever hit your monthly credit limit, your publishing queue and scheduling remain completely active.",
  },
  {
    includeInSchema: true,
    question: "Can I switch billing cycles or cancel at any time?",
    answer:
      "Monthly, quarterly, and annual billing are available. Existing subscribers can open billing management from Settings or the Upgrade button. Available changes, charges, and cancellation terms are shown by Dodo before you confirm.",
  },
  {
    // TODO: Review the absolute account-safety claim with the owner; do not amplify it in schema.
    includeInSchema: false,
    question: "Are my social media accounts protected from bans or shadowbans?",
    answer:
      "100% protected. Draftva connects strictly through official, partner-approved OAuth 2.0 APIs for X, LinkedIn, Threads, Instagram, Facebook, and Reddit. We never ask for your passwords, and we never use unauthorized browser scrapers or bots that violate platform terms.",
  },
  {
    includeInSchema: true,
    question: "How do multiple workspaces and team seats work?",
    answer:
      "Workspaces keep different brands, projects, or agency clients cleanly compartmentalized with their own queues, tone voices, and analytics. Team seats let you invite colleagues, co-founders, or editors to collaborate with granular permissions and approval flows.",
  },
];
