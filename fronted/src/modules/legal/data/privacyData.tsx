import React from "react";
import type { LegalSection } from "../types";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "overview",
    number: "01",
    title: "Overview & Privacy Principles",
    content: (
      <div className="space-y-4">
        <p>
          At Draftva (&quot;Draftva&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), we believe that your privacy, intellectual property, and audience trust are sacred. This Privacy Policy explains how we collect, store, process, transfer, and protect your information when you use our multi-channel social scheduling, composition, and writing assistant platform.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">Official OAuth Only</h3>
            <p className="mt-1 text-xs text-neutral-600">
              We never ask for or store your social network passwords. Every channel connects strictly via official OAuth 2.0 / PKCE authentication.
            </p>
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">Encrypted At Rest</h3>
            <p className="mt-1 text-xs text-neutral-600">
              Access and refresh tokens are encrypted at rest using AES-256 and only decrypted momentarily during active publication.
            </p>
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">Zero-Training AI Guarantee</h3>
            <p className="mt-1 text-xs text-neutral-600">
              Your private drafts, notes, and custom voice samples are never used to train public machine learning or foundation models.
            </p>
          </div>
          <div className="rounded-xl border border-black/[0.06] bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">No Data Selling</h3>
            <p className="mt-1 text-xs text-neutral-600">
              We do not sell, rent, monetize, or trade your personal information or content to data brokers or advertising networks.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "information-collected",
    number: "02",
    title: "Information We Collect",
    content: (
      <div className="space-y-4">
        <p>We collect information in three ways: information you provide directly, information collected automatically, and information received via authorized third-party OAuth flows.</p>
        
        <h3 className="font-heading text-lg font-semibold text-neutral-900 mt-4">1. Information You Provide Directly</h3>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li><strong>Account Details:</strong> Full name, email address, password hash, and profile details.</li>
          <li><strong>Workspace Information:</strong> Workspace name, team member invitations, role designations.</li>
          <li><strong>User Content:</strong> Text posts, thread structures, drafts, notes, uploaded images, video assets, alt text, and custom voice profile samples.</li>
          <li><strong>Billing Information:</strong> Payment card details and billing address (collected and tokenized directly by dodopayment; Draftva never stores full credit card numbers).</li>
          <li><strong>Support Communications:</strong> Messages, feedback, inquiries, or bug reports submitted to our team.</li>
        </ul>

        <h3 className="font-heading text-lg font-semibold text-neutral-900 mt-4">2. Information Received From Connected Channels (OAuth)</h3>
        <p className="text-sm text-neutral-700">
          When you connect a social account (X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook, Instagram, Threads), we receive authorized profile data from that provider:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li>Platform user ID, handle/username, profile display name, and avatar URL.</li>
          <li>OAuth 2.0 access tokens, refresh tokens, token expiration timestamps, and granted permission scopes.</li>
          <li>Target IDs (e.g., Facebook Pages, LinkedIn Company Pages, or subreddit profiles you manage).</li>
          <li>Post metrics fetched on your behalf (views, likes, reposts, comments, impressions) to display in your analytics dashboard.</li>
        </ul>

        <h3 className="font-heading text-lg font-semibold text-neutral-900 mt-4">3. Information Collected Automatically</h3>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li><strong>Log & Usage Data:</strong> IP address, browser type, device information, operating system, time stamps, referrers, and pages visited.</li>
          <li><strong>Cookies & Session Tokens:</strong> Strictly necessary authentication tokens and functional preferences (see our Cookie Policy).</li>
        </ul>
      </div>
    ),
  },
  {
    id: "token-security",
    number: "03",
    title: "OAuth Credentials & Token Security",
    content: (
      <div className="space-y-4">
        <p>
          Connecting social channels requires authorization tokens. Draftva implements bank-grade security protocols to safeguard your tokens:
        </p>
        <div className="rounded-xl border border-black/[0.06] bg-[#f5fbf7] p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="size-2 rounded-full bg-[#1db868] mt-2 shrink-0" />
            <div>
              <p className="font-semibold text-neutral-900 text-sm">AES-256 Envelope Encryption</p>
              <p className="text-xs text-neutral-600 mt-0.5">
                All OAuth access and refresh tokens are encrypted at rest using AES-256-GCM. Encryption keys are managed in isolated key management systems separated from the primary application database.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-2 rounded-full bg-[#1db868] mt-2 shrink-0" />
            <div>
              <p className="font-semibold text-neutral-900 text-sm">Zero Password Exposure</p>
              <p className="text-xs text-neutral-600 mt-0.5">
                Draftva never requests, sees, or handles passwords for your external social media accounts. You authenticate directly on the platform&apos;s official OAuth consent screen.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="size-2 rounded-full bg-[#1db868] mt-2 shrink-0" />
            <div>
              <p className="font-semibold text-neutral-900 text-sm">Instant Token Revocation</p>
              <p className="text-xs text-neutral-600 mt-0.5">
                Disconnecting an account from Workspace Settings immediately purges stored tokens from our database and initiates an official token revocation call to the respective platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "how-we-use-data",
    number: "04",
    title: "How We Use Your Information",
    content: (
      <div className="space-y-4">
        <p>We process your data strictly to fulfill our contractual agreement with you and for legitimate business purposes:</p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700 text-sm">
          <li><strong>Providing the Publishing Pipeline:</strong> Transmitting scheduled posts, media attachments, and thread sequences to your chosen social networks at your specified calendar times.</li>
          <li><strong>AI Assistant Features:</strong> Processing prompt requests to generate drafts, refine copy, suggest hooks, format platform variants, and generate alt text.</li>
          <li><strong>Analytics Aggregation:</strong> Fetching engagement snapshots from official APIs to provide content performance analytics.</li>
          <li><strong>Account & Workspace Management:</strong> Authenticating logins, enforcing role-based permissions, and sending operational notifications.</li>
          <li><strong>Billing & Subscriptions:</strong> Processing payments, invoices, plan changes, and calculating billing quota usage.</li>
          <li><strong>Platform Protection & Fraud Prevention:</strong> Detecting abusive spam patterns, rate limit breaches, and bot automation to protect community integrity.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "ai-data-handling",
    number: "05",
    title: "AI Processing & Model Provider Disclosures",
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-2xs space-y-3">
          <h3 className="font-heading font-semibold text-neutral-900 text-base">Enterprise AI Privacy Protections</h3>
          <p className="text-sm text-neutral-700">
            When you use Draftva&apos;s AI writing assistant, your prompt and context are processed by enterprise LLM infrastructure (e.g., Anthropic Claude, OpenAI, Google Vertex AI).
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-neutral-600">
            <li><strong>Zero Data Retention For Training:</strong> Enterprise contracts guarantee that your prompts, drafts, and voice samples are NOT retained by AI providers to train, fine-tune, or improve foundation models.</li>
            <li><strong>Encrypted In Flight:</strong> All communications between Draftva and AI providers use TLS 1.3 encryption.</li>
            <li><strong>Untrusted Web Scraping Protection:</strong> Any content extracted from URLs you provide for repurposing is sanitized and treated as untrusted data to prevent prompt injection attacks.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "data-sharing",
    number: "06",
    title: "How We Share Your Information",
    content: (
      <div className="space-y-4">
        <p>
          Draftva does not sell or lease your personal data. We disclose your information only in the limited circumstances described below:
        </p>
        <div className="space-y-3 text-sm">
          <div className="p-3.5 rounded-lg border border-neutral-200/80 bg-neutral-50/50">
            <span className="font-semibold text-neutral-900">Official Social Media Platforms:</span>
            <p className="text-neutral-600 text-xs mt-0.5">
              When you trigger or schedule a post, your approved content and media are dispatched directly to the official APIs of X, LinkedIn, Reddit, Bluesky, Mastodon, Facebook, Instagram, or Threads.
            </p>
          </div>
          <div className="p-3.5 rounded-lg border border-neutral-200/80 bg-neutral-50/50">
            <span className="font-semibold text-neutral-900">Trusted Sub-processors:</span>
            <p className="text-neutral-600 text-xs mt-0.5">
              We work with verified service providers for hosting (AWS / GCP), database management, billing (dodopayment), email delivery (Resend), and monitoring. See our <a href="/subprocessors" className="text-[#0f7a47] font-semibold underline underline-offset-2">Sub-processors Directory</a>.
            </p>
          </div>
          <div className="p-3.5 rounded-lg border border-neutral-200/80 bg-neutral-50/50">
            <span className="font-semibold text-neutral-900">Legal Compliance & Protection:</span>
            <p className="text-neutral-600 text-xs mt-0.5">
              We may disclose information if required by a valid legal subpoena, court order, or applicable law, or to prevent imminent fraud, physical harm, or technical compromise.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "data-retention",
    number: "07",
    title: "Data Retention & Account Deletion",
    content: (
      <div className="space-y-4">
        <p>
          We retain your information only as long as your workspace is active or as necessary to provide the Service, resolve disputes, and comply with legal obligations.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700 text-sm">
          <li><strong>Account Deletion:</strong> If you delete your workspace, all scheduled posts, unpublished drafts, uploaded media assets, and connected OAuth tokens are permanently queued for purge within 30 days.</li>
          <li><strong>OAuth Disconnection:</strong> Disconnecting an individual social account purges its encrypted tokens within 24 hours.</li>
          <li><strong>Aggregated Logs:</strong> Anonymized telemetry and error logs may be retained for up to 90 days for operational debugging.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "gdpr-rights",
    number: "08",
    title: "Your Rights Under GDPR (EEA & UK)",
    content: (
      <div className="space-y-4">
        <p>
          If you are located in the European Economic Area (EEA) or the United Kingdom, you have comprehensive privacy rights under the General Data Protection Regulation (GDPR):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg border border-neutral-200/80 bg-white">
            <p className="font-semibold text-neutral-900">Right of Access (Art. 15)</p>
            <p className="text-xs text-neutral-600 mt-1">Request a copy of your personal data processed by Draftva.</p>
          </div>
          <div className="p-3 rounded-lg border border-neutral-200/80 bg-white">
            <p className="font-semibold text-neutral-900">Right to Rectification (Art. 16)</p>
            <p className="text-xs text-neutral-600 mt-1">Correct incomplete or inaccurate personal data.</p>
          </div>
          <div className="p-3 rounded-lg border border-neutral-200/80 bg-white">
            <p className="font-semibold text-neutral-900">Right to Erasure (Art. 17)</p>
            <p className="text-xs text-neutral-600 mt-1">Request deletion of personal data (&quot;Right to be Forgotten&quot;).</p>
          </div>
          <div className="p-3 rounded-lg border border-neutral-200/80 bg-white">
            <p className="font-semibold text-neutral-900">Right to Data Portability (Art. 20)</p>
            <p className="text-xs text-neutral-600 mt-1">Export your content and drafts in a structured, standard format.</p>
          </div>
          <div className="p-3 rounded-lg border border-neutral-200/80 bg-white">
            <p className="font-semibold text-neutral-900">Right to Restrict / Object (Art. 18, 21)</p>
            <p className="text-xs text-neutral-600 mt-1">Object to processing based on legitimate interests.</p>
          </div>
          <div className="p-3 rounded-lg border border-neutral-200/80 bg-white">
            <p className="font-semibold text-neutral-900">Lodge a Complaint</p>
            <p className="text-xs text-neutral-600 mt-1">File a complaint with your local EU Data Protection Authority.</p>
          </div>
        </div>
        <p className="text-sm text-neutral-600">
          To exercise any of these rights, email us at <a href="mailto:privacy@draftva.com" className="text-[#0f7a47] font-semibold underline underline-offset-2">privacy@draftva.com</a>. We respond within 30 days without charge.
        </p>
      </div>
    ),
  },
  {
    id: "ccpa-rights",
    number: "09",
    title: "California Privacy Rights (CCPA / CPRA)",
    content: (
      <div className="space-y-4">
        <p>
          Under the California Consumer Privacy Act as amended by the California Privacy Rights Act (CPRA), California residents are entitled to specific disclosures:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li><strong>We Do Not Sell or Share Personal Data:</strong> Draftva has not sold or shared personal information for cross-context behavioral advertising in the preceding 12 months.</li>
          <li><strong>Right to Know & Access:</strong> You may request the categories and specific pieces of personal information collected.</li>
          <li><strong>Right to Delete:</strong> You have the right to request deletion of personal information subject to legal exemptions.</li>
          <li><strong>Non-Discrimination:</strong> We will not discriminate against you in pricing, service quality, or features for exercising your California privacy rights.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "security-measures",
    number: "10",
    title: "Security Measures (TOMs)",
    content: (
      <div className="space-y-4">
        <p>
          Draftva maintains technical and organizational measures (TOMs) designed to ensure a level of security appropriate to the risk of data processing:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li>TLS 1.3 encryption for all data in transit.</li>
          <li>AES-256 encryption at rest for databases, backups, and secret tokens.</li>
          <li>Multi-factor authentication (MFA) and least-privilege role access for internal systems.</li>
          <li>Continuous automated vulnerability scanning and third-party penetration testing.</li>
          <li>Distributed multi-region backups with recovery point objectives (RPO) under 1 hour.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "contact",
    number: "11",
    title: "Data Protection Officer & Contact",
    content: (
      <div className="space-y-4">
        <p>
          If you have questions, feedback, or requests regarding this Privacy Policy or our data practices, please reach out to our designated Data Protection Officer:
        </p>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-2xs">
          <h3 className="font-heading font-semibold text-neutral-900">Draftva Privacy Office</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Draftva Inc.<br />
            Attn: Data Protection Officer<br />
            Email: <a href="mailto:privacy@draftva.com" className="text-[#0f7a47] font-semibold">privacy@draftva.com</a><br />
            Security reporting: <a href="mailto:security@draftva.com" className="text-[#0f7a47]">security@draftva.com</a>
          </p>
        </div>
      </div>
    ),
  },
];
