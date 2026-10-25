import type { MarketingPath } from "./config";

export interface ProductAnswer {
  id: string;
  question: string;
  answer: string;
}

interface AnswerPage {
  summary: string;
  heading: string;
  questions: ProductAnswer[];
  related: { path: MarketingPath; label: string }[];
}

/** Public product facts only. Shared by visible copy, JSON-LD and llms.txt.
 * Keep prices and quotas in the live billing catalog, not this content map.
 */
export const ANSWER_PAGES = {
  "/": {
    summary:
      "Draftva is an AI social post writer and scheduler for X, LinkedIn and Threads. Turn ideas into drafts in your voice, tailor each version and plan your publishing from one workspace.",
    heading: "Questions about Draftva",
    questions: [
      {
        id: "what-is-draftva",
        question: "What is Draftva?",
        answer:
          "Draftva is a web app for writing, scheduling and reviewing social posts. Creators, founders and teams can keep ideas, platform-specific drafts, connected accounts and post analytics in one workspace.",
      },
      {
        id: "how-draftva-works",
        question: "How do I go from an idea to a scheduled post?",
        answer:
          "Start with an idea or rough draft, refine it with the AI assistant, choose your connected accounts and review each channel's version. Publish when you are ready or choose a scheduled time. You decide the content and destination.",
      },
      {
        id: "start-with-free",
        question: "Can I start using Draftva for free?",
        answer:
          "Yes. Draftva has a Free plan with no trial deadline. Paid plans include unlimited posts, higher AI allowances and custom brand voice profiles. See the pricing page for current prices and limits; platform rate limits and publishing safeguards still apply.",
      },
    ],
    related: [
      { path: "/product/ai-writer", label: "Explore the AI post writer" },
      { path: "/product/schedule", label: "Explore post scheduling" },
      { path: "/pricing", label: "Compare plans and current limits" },
    ],
  },
  "/product/ai-writer": {
    summary:
      "Draftva's AI post writer turns rough ideas into drafts for X, LinkedIn and Threads. Rewrite in a chosen tone, adapt each channel's version and review the text before publishing.",
    heading: "Questions about AI post writing",
    questions: [
      {
        id: "ai-writing-help",
        question: "What can Draftva's AI writing assistant help with?",
        answer:
          "The assistant helps draft and rewrite social posts, suggest hooks, expand an idea into a thread and adapt text for different channels. Available writing tools depend on the selected platform. You can edit the result before scheduling or publishing.",
      },
      {
        id: "ai-brand-voice",
        question: "Can the AI write in my brand voice?",
        answer:
          "Paid plans include custom brand voice profiles. Add tone guidance and writing samples, then select the profile that fits the brand you are writing for. The AI uses that guidance when drafting; review the result to keep it accurate and personal.",
      },
      {
        id: "ai-credit-limit",
        question: "What happens when my AI credits run out?",
        answer:
          "AI features use your workspace's credit allowance. When the available balance is exhausted, further AI requests are blocked until credits become available. You can still write and edit manually, and scheduled posts remain subject to your publishing plan and connected account status.",
      },
    ],
    related: [
      { path: "/product/schedule", label: "Schedule your finished drafts" },
      { path: "/pricing", label: "Compare AI allowances and brand profiles" },
    ],
  },
  "/product/schedule": {
    summary:
      "Draftva is a social media post scheduler for X, LinkedIn and Threads. Review channel-specific drafts, choose a time and manage your publishing queue in one workspace.",
    heading: "Questions about scheduling posts",
    questions: [
      {
        id: "schedule-across-channels",
        question:
          "Can I schedule different versions for different social channels?",
        answer:
          "Yes. A Draftva post can have a separate version for each connected account, with its own content and scheduled time. Review each version for the destination platform before adding it to your publishing schedule.",
      },
      {
        id: "scheduled-post-limits",
        question: "Are scheduled posts unlimited on paid plans?",
        answer:
          "Paid Draftva plans include unlimited posts. Social platforms still enforce their own rate limits, permissions and media rules, and Draftva applies publishing safeguards including an X spending guard. Unlimited posts do not remove those restrictions.",
      },
      {
        id: "schedule-account-disconnected",
        question: "What if a connected account needs to be reconnected?",
        answer:
          "Publishing requires a valid connection and the necessary platform permissions. If access expires or is revoked, reconnect the account in Channels and review any affected posts before trying again.",
      },
    ],
    related: [
      {
        path: "/product/social-integration",
        label: "Learn about connected accounts",
      },
      { path: "/pricing", label: "Compare publishing plans" },
    ],
  },
  "/product/analytics": {
    summary:
      "Draftva brings post analytics from connected social accounts into one workspace. Review the metrics each platform makes available, compare posts and use those results to plan your next draft.",
    heading: "Questions about post analytics",
    questions: [
      {
        id: "analytics-data-source",
        question: "Where does Draftva get social analytics data?",
        answer:
          "Draftva retrieves metrics through connected platforms' official APIs. Results can be cached and stored as snapshots, so the view reflects the latest available sync. Available metrics depend on the platform, account type, granted permissions and API access.",
      },
      {
        id: "analytics-missing-metrics",
        question: "Why are some social metrics unavailable?",
        answer:
          "Platforms expose different metrics and may restrict access by account type or permissions. A missing metric means the provider did not supply it; it should not be interpreted as zero. Reconnect an account if Draftva asks for updated access.",
      },
      {
        id: "analytics-account-posts",
        question: "Can analytics include posts published outside Draftva?",
        answer:
          "Where the platform's official account feed supports it, analytics includes posts from the selected connected account even if they were published elsewhere. Some integrations can only return metrics for posts published through Draftva. Provider access and fetch limits can affect coverage.",
      },
    ],
    related: [
      {
        path: "/product/social-integration",
        label: "Review social account integrations",
      },
      { path: "/product/ai-writer", label: "Turn insights into a new draft" },
    ],
  },
  "/product/social-integration": {
    summary:
      "Connect social accounts to Draftva through each platform's authorization flow. Write and schedule versions for X, LinkedIn and Threads from one workspace, with options based on each account's capabilities.",
    heading: "Questions about connecting social accounts",
    questions: [
      {
        id: "connect-social-account",
        question: "How do I connect a social account to Draftva?",
        answer:
          "Open Channels in your workspace, choose a platform and complete its authorization flow. Available destinations and permissions vary by platform and account type. Once connected, choose that account when preparing a post.",
      },
      {
        id: "social-account-passwords",
        question: "Do I need to give Draftva my social account password?",
        answer:
          "Connections use the platform's authorization flow rather than asking you to store a social account password in Draftva. Review the permissions on the platform's authorization screen before approving access.",
      },
      {
        id: "social-account-guarantees",
        question:
          "Does connecting an account guarantee every publishing feature?",
        answer:
          "No. Platforms decide which post types, metrics and destinations their APIs support. Your account type and permissions also matter. Draftva cannot guarantee reach, engagement or protection from a platform's moderation decisions.",
      },
    ],
    related: [
      {
        path: "/product/schedule",
        label: "Plan posts for your connected accounts",
      },
      {
        path: "/product/analytics",
        label: "Understand available account metrics",
      },
    ],
  },
  "/product/mcp": {
    summary:
      "Draftva's MCP integration connects compatible AI assistants to your workspace. Use an authorized assistant to create drafts and manage your social publishing workflow from a conversation.",
    heading: "Questions about Draftva MCP",
    questions: [
      {
        id: "what-is-draftva-mcp",
        question: "What is Draftva's MCP integration?",
        answer:
          "MCP stands for Model Context Protocol. Draftva exposes workspace tools through an MCP server so compatible AI clients can work with drafts, accounts, schedules and analytics using an authorized connection.",
      },
      {
        id: "connect-draftva-mcp",
        question: "How do I connect an AI assistant to Draftva?",
        answer:
          "Open Agents in your Draftva workspace and follow the setup instructions for your client. Copy the server URL shown there, add it in a compatible MCP client and authorize the workspace access you want to grant. Client support and setup steps vary.",
      },
      {
        id: "mcp-publishing-access",
        question: "What can a connected AI assistant do?",
        answer:
          "Access depends on the permissions you grant. Read access, draft editing, publishing and Draftva AI use are separate scopes. Review those permissions during authorization and confirm the content, destination and time before asking an assistant to publish or schedule.",
      },
    ],
    related: [
      {
        path: "/product/ai-writer",
        label: "Explore Draftva's writing assistant",
      },
      { path: "/privacy", label: "Read how Draftva handles data" },
    ],
  },
  "/about": {
    summary:
      "Draftva is an AI social writing and scheduling app built by Ajay Singh for creators, founders and teams. It brings ideas, drafts and publishing into one workspace while keeping your voice and review at the center.",
    heading: "Questions about Draftva and its approach",
    questions: [
      {
        id: "who-built-draftva",
        question: "Who built Draftva?",
        answer:
          "Draftva is built by Ajay Singh, its founder and product architect. The product focuses on helping creators and founders turn ideas into social posts with less switching between writing and publishing tools.",
      },
      {
        id: "who-is-draftva-for",
        question: "Who is Draftva for?",
        answer:
          "Draftva is for creators, founders and teams building a personal or company brand through social posts. Workspaces help keep different brands or projects organized, with plan limits shown on the pricing page.",
      },
      {
        id: "draftva-writing-approach",
        question: "How does Draftva approach AI writing?",
        answer:
          "AI helps shape an idea rather than replacing your point of view. Your tone guidance, writing samples and edits guide the draft, and you decide what is scheduled or published.",
      },
    ],
    related: [
      { path: "/product/ai-writer", label: "See how AI writing works" },
      { path: "/pricing", label: "Find a plan for your workflow" },
    ],
  },
} satisfies Partial<Record<MarketingPath, AnswerPage>>;

export type AnswerPath = keyof typeof ANSWER_PAGES;
export function answerPage(path: MarketingPath): AnswerPage | undefined {
  return (ANSWER_PAGES as Partial<Record<MarketingPath, AnswerPage>>)[path];
}
