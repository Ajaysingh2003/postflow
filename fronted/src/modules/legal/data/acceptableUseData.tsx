import React from "react";
import type { LegalSection } from "../types";

export const ACCEPTABLE_USE_SECTIONS: LegalSection[] = [
  {
    id: "purpose",
    number: "01",
    title: "Purpose & Guiding Principles",
    content: (
      <div className="space-y-4">
        <p>
          Draftva was built to empower authentic creators, founders, agencies, and businesses to write compelling content, maintain consistent publishing habits, and grow engaged audiences across major social networks.
        </p>
        <p>
          To protect our users, uphold platform health, and comply with official partner agreements, this Acceptable Use Policy (&quot;AUP&quot;) establishes mandatory standards of conduct. By accessing or using Draftva, you agree to adhere strictly to this policy.
        </p>
        <div className="rounded-xl border border-black/[0.06] bg-[#f5fbf7] p-4 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">Zero Tolerance for Spam:</p>
          <p className="mt-1 text-neutral-600">
            Draftva is not an automated spamming tool, lead scraper, or bot network. Any attempt to use our scheduling pipeline or AI assistant for spam, fake engagement, or vote manipulation will result in permanent account termination.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "prohibited-content",
    number: "02",
    title: "Prohibited Content",
    content: (
      <div className="space-y-4">
        <p>You may not compose, upload, schedule, or publish any content that contains, promotes, or facilitates:</p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700 text-sm">
          <li><strong>Hate Speech & Discrimination:</strong> Attacks, threats, incitement of violence, or dehumanizing speech based on race, ethnicity, national origin, religion, disability, age, gender, or sexual orientation.</li>
          <li><strong>Harassment & Bullying:</strong> Targeted abuse, doxxing, non-consensual personal disclosures, or relentless unwanted contact.</li>
          <li><strong>Deceptive & Fraudulent Content:</strong> Phishing links, investment scams, deceptive financial schemes, fake giveaways, or coordinated disinformation campaigns.</li>
          <li><strong>Malware & Harmful Code:</strong> Links to viruses, spyware, trojans, ransomware, or malicious browser exploits.</li>
          <li><strong>Sexually Explicit & Non-Consensual Imagery:</strong> Pornography, adult services, non-consensual sexual media, or any content depicting child sexual exploitation or abuse (CSAM).</li>
          <li><strong>Intellectual Property Infringement:</strong> Content violating third-party copyrights, registered trademarks, trade secrets, or patents.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "prohibited-activities",
    number: "03",
    title: "Prohibited Automation & Manipulation",
    content: (
      <div className="space-y-4">
        <p>Draftva connects strictly to official social platform APIs. The following automated activities are strictly forbidden:</p>
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900 text-sm">Reddit Vote & Engagement Manipulation</h5>
            <p className="mt-1 text-xs text-neutral-600">
              You must not use Draftva for auto-voting, auto-commenting, coordinated upvoting, or spamming subreddits with duplicate link drops. Cross-posting to subreddits must be an explicit, community-relevant choice respecting individual subreddit rules and flair requirements.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900 text-sm">Mass Duplicate Cross-Posting</h5>
            <p className="mt-1 text-xs text-neutral-600">
              Blasting identical, spammy, or commercial affiliate links simultaneously across dozens of unrelated channels or subreddits without tailoring to community norms is strictly prohibited.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900 text-sm">Scraping & Lead Harvesting</h5>
            <p className="mt-1 text-xs text-neutral-600">
              Draftva is not a prospect scraper. You may not use Draftva or connected tools to extract private user profiles, scrape email addresses, or conduct automated bulk cold outreach without explicit consent.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900 text-sm">Circumventing Platform Rate Limits</h5>
            <p className="mt-1 text-xs text-neutral-600">
              You may not deliberately exploit or flood Draftva&apos;s queue to evade official social network rate limits or API quotas.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "platform-compliance",
    number: "04",
    title: "Platform-Specific Rules",
    content: (
      <div className="space-y-4">
        <p>In addition to Draftva&apos;s rules, you are bound by the policies of every network where you publish:</p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700 text-sm">
          <li><strong>X (Twitter):</strong> Compliance with the X Rules, Automation Rules, and Developer Policy. No coordinated bot accounts or trend manipulation.</li>
          <li><strong>LinkedIn:</strong> Adherence to the LinkedIn Professional Community Policies and User Agreement. No automated connection scraping or auto-DMs.</li>
          <li><strong>Reddit:</strong> Compliance with the Reddit Content Policy, User Agreement, and individual subreddit moderation rules. Respect subreddit flairs, title formatting, and self-promotion guidelines.</li>
          <li><strong>Meta (Facebook & Instagram):</strong> Compliance with Meta&apos;s Community Standards and Commercial Terms. Publishing is restricted to official Pages and Professional Business/Creator accounts.</li>
          <li><strong>Bluesky & Mastodon:</strong> Respect for open AT Protocol norms, federated instance rules, server-specific character limits, and content warning (CW) conventions.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "ai-guidelines",
    number: "05",
    title: "AI Writing Assistant Guidelines",
    content: (
      <div className="space-y-4">
        <p>When using Draftva&apos;s platform-aware AI writing assistant, you agree to the following ethical guidelines:</p>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li>Do not prompt the assistant to generate malicious software, exploit code, social engineering bait, or phishing emails.</li>
          <li>Do not use the assistant to produce deceptive political disinformation, non-consensual deepfakes, or fabricate medical or legal advice.</li>
          <li>Do not attempt prompt injection attacks against our systems or attempt to bypass system safety instructions.</li>
          <li>You maintain ultimate editorial accountability for all content published through your connected accounts.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "enforcement",
    number: "06",
    title: "Investigation, Enforcement & Appeals",
    content: (
      <div className="space-y-4">
        <p>Draftva reserves the right to review content and publishing activity when reported or flagged by automated safety filters:</p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700 text-sm">
          <li><strong>Warnings:</strong> For minor or unintentional infractions, we may issue an advisory notice requiring content adjustment.</li>
          <li><strong>Queue Pausing:</strong> We may temporarily halt scheduled publications if rate limits or platform safety flags are triggered.</li>
          <li><strong>Account Suspension or Termination:</strong> Serious, repeated, or deliberate violations will result in immediate workspace termination without refund.</li>
        </ul>
        <p className="text-sm text-neutral-600">
          If you believe your account was suspended in error, you may file an appeal by contacting <a href="mailto:appeals@draftva.com" className="text-[#0f7a47] font-semibold underline underline-offset-2">appeals@draftva.com</a> with relevant context.
        </p>
      </div>
    ),
  },
  {
    id: "reporting",
    number: "07",
    title: "Reporting Violations",
    content: (
      <div className="space-y-4">
        <p>
          If you encounter any content, account, or activity that you suspect violates this Acceptable Use Policy, please report it immediately to our Trust & Safety team:
        </p>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-2xs">
          <h5 className="font-heading font-semibold text-neutral-900">Draftva Trust & Safety</h5>
          <p className="mt-1 text-sm text-neutral-600">
            Email: <a href="mailto:trust@draftva.com" className="text-[#0f7a47] font-semibold">trust@draftva.com</a><br />
            Include relevant post links, screenshots, workspace IDs, or headers where applicable.
          </p>
        </div>
      </div>
    ),
  },
];
