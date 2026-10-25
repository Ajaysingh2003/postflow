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
      "Yes. Draftva has a Free plan with no trial deadline and limited AI credits, posts and connected accounts. Paid plans start at checkout and include unlimited posts, higher AI allowances and custom brand voice profiles. Check the plan cards for current prices and limits.",
  },
  {
    includeInSchema: true,
    question: "Is post scheduling truly unlimited on all paid plans?",
    answer:
      "Every paid Draftva plan includes unlimited scheduled and published posts. Platform rate limits, account permissions, media requirements and Draftva publishing safeguards, including the X spending guard, still apply.",
  },
  {
    includeInSchema: true,
    question: "What are AI credits and how are they counted?",
    answer:
      "AI credits are used for Draftva assistant requests such as drafting, rewriting and adapting posts. Your workspace usage card shows the available balance and reset date. If credits run out, you can still write manually and manage scheduled posts within your publishing plan.",
  },
  {
    includeInSchema: true,
    question: "Can I switch billing cycles or cancel at any time?",
    answer:
      "Monthly, quarterly, and annual billing are available. Existing subscribers can open billing management from Settings or the Upgrade button. Available changes, charges, and cancellation terms are shown by Dodo before you confirm.",
  },
  {
    includeInSchema: true,
    question: "Does Draftva guarantee protection from bans or shadowbans?",
    answer:
      "No tool can guarantee protection from a platform's moderation decisions. Draftva uses official platform authorization and APIs for its social connections. You remain responsible for your content and each platform's rules; availability depends on account permissions and platform access.",
  },
  {
    includeInSchema: true,
    question: "How do multiple workspaces and team seats work?",
    answer:
      "Workspaces keep different brands, projects, or agency clients cleanly compartmentalized with their own queues, tone voices, and analytics. Team seats let you invite colleagues, co-founders, or editors to collaborate with granular permissions and approval flows.",
  },
];
