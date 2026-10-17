import React from "react";
import Link from "next/link";
import type { LegalSection } from "../types";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    number: "01",
    title: "Acceptance of Terms & Eligibility",
    content: (
      <div className="space-y-4">
        <p>
          Welcome to Draftva. These Terms of Service (&quot;Terms&quot;,
          &quot;Agreement&quot;) constitute a legally binding agreement between
          you (&quot;User&quot;, &quot;you&quot;, or &quot;your&quot;) and
          Draftva Inc. (&quot;Draftva&quot;, &quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;), governing your access to and use of the Draftva web
          platform, desktop applications, API integrations, and related software
          tools (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By creating an account, accessing, or using the Service, you
          acknowledge that you have read, understood, and agree to be bound by
          these Terms and our Privacy Policy. If you are entering into this
          Agreement on behalf of a company, organization, or other legal entity,
          you represent and warrant that you have the authority to bind such
          entity to these Terms.
        </p>
        <div className="rounded-xl border border-black/[0.06] bg-[#f5fbf7] p-4 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">
            Eligibility Requirement:
          </p>
          <p className="mt-1 text-neutral-600">
            You must be at least 18 years of age (or the minimum legal age of
            majority in your jurisdiction) to register an account or use
            Draftva. By using the Service, you warrant that you satisfy this
            eligibility requirement.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "services-scope",
    number: "02",
    title: "Description of the Service",
    content: (
      <div className="space-y-4">
        <p>
          Draftva provides an intelligent, multi-channel social media
          management, content composition, post scheduling, and writing
          assistant platform. The Service enables users to:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>
            Connect official accounts across supported networks: X (formerly
            Twitter), LinkedIn (Profiles and Organization Pages), Reddit,
            Bluesky, Mastodon, Facebook Pages, Instagram (Business and Creator
            accounts), and Threads.
          </li>
          <li>
            Compose, tailor, format, and preview platform-specific content
            variants in a unified composer.
          </li>
          <li>
            Schedule publications into queues and calendar slots with automated
            dispatch through official platform APIs.
          </li>
          <li>
            Utilize platform-aware AI assistant features (hook generation,
            thread composition, rewrite suggestions, and voice profiles).
          </li>
          <li>
            Collaborate in shared workspaces with role-based member permissions
            and review workflows.
          </li>
          <li>
            Aggregate post metrics and engagement snapshots fetched from
            connected platforms.
          </li>
        </ul>
        <p>
          Draftva reserves the right to modify, enhance, deprecate, or suspend
          any feature of the Service at any time, provided that material
          reductions in functionality for paid subscriptions will be
          communicated with reasonable advance notice.
        </p>
      </div>
    ),
  },
  {
    id: "accounts-workspaces",
    number: "03",
    title: "Accounts, Workspaces & Security",
    content: (
      <div className="space-y-4">
        <p>
          To access the Service, you must create a Draftva account. You agree to
          provide accurate, current, and complete information during
          registration and keep your account profile updated.
        </p>
        <h4 className="font-heading text-lg font-semibold text-neutral-900 mt-4">
          Workspace Roles & Collaboration
        </h4>
        <p>
          Accounts operate within Workspaces. Workspace owners and
          administrators may invite team members, assign role permissions
          (Owner, Admin, Member, Editor), and govern channel access. The
          Workspace Owner remains responsible for all actions taken under their
          workspace.
        </p>
        <h4 className="font-heading text-lg font-semibold text-neutral-900 mt-4">
          Account Credentials & Security
        </h4>
        <p>
          You are responsible for maintaining the confidentiality of your login
          credentials and for all activities that occur under your account. You
          agree to notify Draftva immediately at{" "}
          <a
            href="mailto:security@draftva.com"
            className="text-[#0f7a47] font-semibold underline underline-offset-2"
          >
            security@draftva.com
          </a>{" "}
          upon suspecting any unauthorized access or breach of security.
        </p>
      </div>
    ),
  },
  {
    id: "subscriptions-billing",
    number: "04",
    title: "Free Plan, Subscriptions & Billing",
    content: (
      <div className="space-y-4">
        <p>
          Draftva offers an ongoing Free plan with usage limits and optional
          paid subscription plans.
        </p>
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900">
              Free Plan
            </h5>
            <p className="mt-1 text-sm text-neutral-600">
              The Free plan has no trial deadline and does not automatically
              convert into a paid subscription. Paid plans begin at checkout
              without a separate free trial.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900">
              Automatic Renewal & Payments
            </h5>
            <p className="mt-1 text-sm text-neutral-600">
              Paid subscriptions renew automatically at the end of each billing
              cycle (monthly or annually) until you cancel. Payments are
              processed through Dodo Payments. All fees are quoted in U.S.
              Dollars (USD) and are non-refundable except where required by law.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h5 className="font-heading font-semibold text-neutral-900">
              Cancellation & Upgrades
            </h5>
            <p className="mt-1 text-sm text-neutral-600">
              You may cancel your subscription at any time in Settings &gt;
              Billing. Upon cancellation, your access continues until the end of
              the current paid billing cycle. No further recurring charges will
              be incurred.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "content-ip",
    number: "05",
    title: "Intellectual Property & Content Ownership",
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#3fda8a]/30 bg-[#3fda8a]/10 p-4 text-neutral-900">
          <p className="font-heading font-semibold text-base">
            Key Guarantee: Your Content Remains 100% Yours
          </p>
          <p className="mt-1 text-sm text-neutral-700">
            Draftva does not claim any ownership, copyright, or moral rights in
            the texts, images, videos, audio, attachments, ideas, or prompts you
            upload, compose, or publish through the Service (&quot;User
            Content&quot;).
          </p>
        </div>
        <p>
          By submitting User Content to Draftva, you grant us solely a limited,
          non-exclusive, worldwide, royalty-free license to store, parse,
          format, display, and transmit your User Content solely to the extent
          necessary to provide, maintain, and publish your content to your
          connected social channels as instructed by you.
        </p>
        <p>
          Draftva and its licensors retain all right, title, and interest
          (including all patent, copyright, trademark, trade secret, and other
          intellectual property rights) in and to the Service, including
          software architecture, UI components, brand design, algorithms,
          documentation, and APIs.
        </p>
      </div>
    ),
  },
  {
    id: "social-platforms",
    number: "06",
    title: "Third-Party Social Platforms & Official APIs",
    content: (
      <div className="space-y-4">
        <p>
          Draftva connects with third-party social media networks exclusively
          through their official, public, and partner APIs. Draftva strictly
          prohibits and does not use screen scraping, unofficial private
          endpoints, browser emulation automation, or password credential
          storage.
        </p>
        <p>
          Your use of connected accounts is subject to the respective platform
          agreements and developer terms:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-neutral-200/80 p-3 bg-neutral-50/50">
            <p className="font-semibold text-neutral-900">X (Twitter)</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              X Developer Agreement and Policy
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200/80 p-3 bg-neutral-50/50">
            <p className="font-semibold text-neutral-900">LinkedIn</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              LinkedIn API Terms of Use & Partner Policies
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200/80 p-3 bg-neutral-50/50">
            <p className="font-semibold text-neutral-900">
              Meta (Facebook & Instagram)
            </p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Meta Platform Terms & Graph API Policies
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200/80 p-3 bg-neutral-50/50">
            <p className="font-semibold text-neutral-900">Reddit</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Reddit Data API Terms & Developer Guidelines
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200/80 p-3 bg-neutral-50/50">
            <p className="font-semibold text-neutral-900">Bluesky</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              AT Protocol Standards & Bluesky Terms
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200/80 p-3 bg-neutral-50/50">
            <p className="font-semibold text-neutral-900">Mastodon</p>
            <p className="text-neutral-500 text-xs mt-0.5">
              Decentralized instance server rules & API terms
            </p>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Draftva is not responsible for platform rate limiting, API outages,
          changes in third-party API availability, or account suspensions
          initiated directly by third-party social networks.
        </p>
      </div>
    ),
  },
  {
    id: "ai-assistant",
    number: "07",
    title: "AI Assistant Features & Content Disclaimers",
    content: (
      <div className="space-y-4">
        <p>
          Draftva includes intelligent AI assistant features designed to aid in
          drafting, rewriting, generating hooks, creating thread outlines, and
          formatting post variants.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>
            <strong>Assistive Nature:</strong> AI outputs are recommendations.
            You are solely responsible for reviewing, verifying accuracy, and
            approving all content prior to publication.
          </li>
          <li>
            <strong>No Model Training:</strong> Draftva uses commercial
            enterprise LLM APIs with zero-data-retention agreements. Your
            private drafts, unpublished notes, and custom voice samples are
            never used to train public machine learning models.
          </li>
          <li>
            <strong>Factual Accuracy:</strong> Generative AI can produce
            hallucinations or imprecise assertions. Draftva disclaims liability
            for inaccuracies in AI-assisted suggestions.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "acceptable-conduct",
    number: "08",
    title: "Acceptable Conduct & Prohibited Uses",
    content: (
      <div className="space-y-4">
        <p>
          You agree not to misuse the Service. Specifically, you agree not to:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-neutral-700">
          <li>
            Use Draftva for any unlawful, harassing, defamatory, fraudulent, or
            harmful purposes.
          </li>
          <li>
            Engage in automated vote manipulation, auto-commenting, mass
            spamming, or coordinated inauthentic behavior on Reddit, X,
            LinkedIn, or any supported network.
          </li>
          <li>
            Publish content violating copyright, trademark, privacy, or
            proprietary rights of any third party.
          </li>
          <li>
            Attempt to reverse-engineer, decompile, scrape, or probe the
            vulnerabilities of Draftva&apos;s infrastructure.
          </li>
          <li>
            Resell, sublicense, or rent access to Draftva without an authorized
            agency partner agreement.
          </li>
        </ul>
        <p>
          Violation of these rules will result in immediate suspension or
          termination of your account without refund. Please see our{" "}
          <Link
            href="/acceptable-use"
            className="text-[#0f7a47] font-semibold underline underline-offset-2"
          >
            Acceptable Use Policy
          </Link>{" "}
          for further details.
        </p>
      </div>
    ),
  },
  {
    id: "disclaimers",
    number: "09",
    title: "Service Availability & Warranties",
    content: (
      <div className="space-y-4">
        <p className="uppercase text-xs font-semibold tracking-wider text-neutral-500">
          Disclaimer of Warranties
        </p>
        <p className="text-neutral-700">
          THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
          OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT.
        </p>
        <p className="text-neutral-700">
          DRAFTVA DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          TIMELY, SECURE, OR ERROR-FREE, OR THAT ANY CONTENT SCHEDULED FOR
          PUBLICATION WILL BE POSTED WITHOUT DELAY IN CASES OF THIRD-PARTY API
          OUTAGES, NETWORK FAILURES, OR PLATFORM CHANGES.
        </p>
      </div>
    ),
  },
  {
    id: "liability",
    number: "10",
    title: "Limitation of Liability",
    content: (
      <div className="space-y-4">
        <p className="uppercase text-xs font-semibold tracking-wider text-neutral-500">
          Cap on Liability
        </p>
        <p className="text-neutral-700">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
          DRAFTVA, ITS DIRECTORS, EMPLOYEES, PARTNERS, OR AGENTS BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
          (INCLUDING LOSS OF PROFITS, DATA, USE, GOODWILL, OR BUSINESS
          REPUTATION) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY
          TO USE THE SERVICE.
        </p>
        <p className="text-neutral-700">
          IN NO EVENT SHALL DRAFTVA&apos;S TOTAL AGGREGATE LIABILITY EXCEED THE
          GREATER OF ONE HUNDRED U.S. DOLLARS ($100 USD) OR THE TOTAL AMOUNT
          PAID BY YOU TO DRAFTVA IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>
      </div>
    ),
  },
  {
    id: "termination",
    number: "11",
    title: "Termination & Suspension",
    content: (
      <div className="space-y-4">
        <p>
          You may terminate your account at any time by navigating to Workspace
          Settings and selecting &quot;Delete Workspace&quot; or by contacting
          our support team.
        </p>
        <p>
          Draftva may suspend or terminate your account immediately if you
          breach these Terms, violate platform developer policies, fail to pay
          subscription dues, or engage in behavior detrimental to the platform
          or other users.
        </p>
        <p>
          Upon termination, all licenses granted to you terminate, and your
          scheduled queue will cease dispatching. We will retain or delete your
          data in accordance with our Privacy Policy.
        </p>
      </div>
    ),
  },
  {
    id: "governing-law",
    number: "12",
    title: "Dispute Resolution & Governing Law",
    content: (
      <div className="space-y-4">
        <p>
          These Terms and any dispute arising out of or related to this
          Agreement shall be governed by and construed in accordance with the
          laws of the State of Delaware, United States, without regard to
          conflict of law principles.
        </p>
        <p>
          Before filing a formal claim, both parties agree to attempt to resolve
          disputes informally by contacting{" "}
          <a
            href="mailto:legal@draftva.com"
            className="text-[#0f7a47] font-semibold underline underline-offset-2"
          >
            legal@draftva.com
          </a>
          . Any legal action or proceeding arising under these Terms shall be
          brought exclusively in the state or federal courts located in
          Delaware.
        </p>
      </div>
    ),
  },
  {
    id: "contact-info",
    number: "13",
    title: "Changes to Terms & Contact",
    content: (
      <div className="space-y-4">
        <p>
          We may update these Terms periodically to reflect changes in our
          Service, legal obligations, or platform partner policies. We will
          provide notice of material updates by posting the new terms with an
          updated &quot;Last Updated&quot; date and, where appropriate,
          notifying you via email or in-app notification.
        </p>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-2xs">
          <h5 className="font-heading font-semibold text-neutral-900">
            Legal Contact
          </h5>
          <p className="mt-1 text-sm text-neutral-600">
            Draftva Inc.
            <br />
            Attn: Legal & Compliance Department
            <br />
            Email:{" "}
            <a
              href="mailto:legal@draftva.com"
              className="text-[#0f7a47] font-semibold"
            >
              legal@draftva.com
            </a>
            <br />
            Website:{" "}
            <a href="https://draftva.com" className="text-[#0f7a47]">
              https://draftva.com
            </a>
          </p>
        </div>
      </div>
    ),
  },
];
