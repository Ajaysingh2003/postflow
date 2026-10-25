import React from "react";
import type { LegalSection } from "../types";

export const SUBPROCESSORS_SECTIONS: LegalSection[] = [
  {
    id: "overview",
    number: "01",
    title: "Sub-processor Due Diligence & Standards",
    content: (
      <div className="space-y-4">
        <p>
          To deliver a reliable, highly available, and secure multi-channel scheduling platform, Draftva partners with vetted third-party service providers (&quot;Sub-processors&quot;).
        </p>
        <p>
          Before engaging any sub-processor, Draftva conducts comprehensive security and privacy evaluations to verify compliance with industry standards, including SOC 2 Type II, ISO/IEC 27001, and GDPR Article 28 data processing safeguards.
        </p>
        <div className="rounded-xl border border-black/[0.06] bg-[#f5fbf7] p-4 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">Contractual Privacy Guarantee:</p>
          <p className="mt-1 text-neutral-600">
            Every vendor listed below has executed a binding Data Processing Addendum (DPA) incorporating EU Standard Contractual Clauses (SCCs) where international transfers occur.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "infrastructure-hosting",
    number: "02",
    title: "Core Infrastructure & Hosting",
    content: (
      <div className="space-y-4">
        <p>These sub-processors provide the cloud hosting, database clusters, compute nodes, and content delivery network powering Draftva:</p>
        <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/80 font-subheading text-xs uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="p-3.5">Sub-processor</th>
                <th className="p-3.5">Entity Location</th>
                <th className="p-3.5">Purpose & Function</th>
                <th className="p-3.5">Data Location</th>
                <th className="p-3.5">Certifications</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Amazon Web Services (AWS)</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Cloud compute, media asset storage (S3), and scheduling queue</td>
                <td className="p-3.5">US / EU Regions</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">SOC 2, ISO 27001</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Supabase Inc.</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Managed PostgreSQL database, replication, and token encryption vault</td>
                <td className="p-3.5">US / EU Regions</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">SOC 2 Type II</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Cloudflare Inc.</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">DDoS mitigation, web application firewall (WAF), and global edge CDN</td>
                <td className="p-3.5">Global Edge</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">SOC 2, ISO 27001</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "ai-providers",
    number: "03",
    title: "AI Writing Assistant & LLM Providers",
    content: (
      <div className="space-y-4">
        <p>Draftva integrates enterprise AI inference endpoints to power platform-aware copywriting, hook generation, thread composition, and alt text:</p>
        <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/80 font-subheading text-xs uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="p-3.5">Sub-processor</th>
                <th className="p-3.5">Entity Location</th>
                <th className="p-3.5">Purpose & Function</th>
                <th className="p-3.5">Training Retention Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Anthropic PBC</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Claude model inference for thread writing, rewriting, and voice profiles</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Zero Retention / No Training</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">OpenAI LLC</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Content suggestions, hook ideation, and automated alt-text generation</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Zero Retention / No Training</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Google Cloud (Vertex AI)</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Multimodal analysis and media captioning assistance</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Zero Retention / No Training</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "payments-operations",
    number: "04",
    title: "Payments & Operational Services",
    content: (
      <div className="space-y-4">
        <p>These sub-processors support billing, subscription administration, transactional notifications, and system telemetry:</p>
        <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/80 font-subheading text-xs uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="p-3.5">Sub-processor</th>
                <th className="p-3.5">Entity Location</th>
                <th className="p-3.5">Function</th>
                <th className="p-3.5">Data Shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">dodopayment Inc.</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Payment gateway, subscription recurring billing, invoice generation</td>
                <td className="p-3.5">Payment tokens, name, email, billing address</td>
              </tr>
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Resend Inc.</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Transactional emails (OTP verification, billing receipts, team invites)</td>
                <td className="p-3.5">Email address, recipient name</td>
              </tr>
              <tr>
                <td className="p-3.5 font-semibold text-neutral-900">Functional Software (Sentry)</td>
                <td className="p-3.5">United States</td>
                <td className="p-3.5">Frontend and backend application error tracking and diagnostics</td>
                <td className="p-3.5">Anonymized error stack traces, browser user-agent</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "notification-updates",
    number: "05",
    title: "Notifications of Changes & Objections",
    content: (
      <div className="space-y-4">
        <p>
          Draftva provides advance notification of any new sub-processor at least 30 days prior to granting access to customer personal data.
        </p>
        <p className="text-sm text-neutral-700">
          To subscribe to automatic email updates regarding sub-processor changes or to submit a formal objection on data protection grounds, please contact our Data Protection Officer at <a href="mailto:privacy@draftva.com" className="text-[#0f7a47] font-semibold underline underline-offset-2">privacy@draftva.com</a> with the subject line <em>&quot;Sub-processor Notification Subscription&quot;</em>.
        </p>
      </div>
    ),
  },
];
