import React from "react";
import type { LegalSection } from "../types";

export const DPA_SECTIONS: LegalSection[] = [
  {
    id: "scope-definitions",
    number: "01",
    title: "Scope, Definitions & Applicability",
    content: (
      <div className="space-y-4">
        <p>
          This Data Processing Addendum (&quot;DPA&quot;) supplements the Draftva Terms of Service or other written agreement between you (or the entity you represent, &quot;Customer&quot;) and Draftva Inc. (&quot;Draftva&quot;).
        </p>
        <p>
          This DPA applies where and to the extent that Draftva processes Customer Personal Data in the course of providing the Service, and such processing is subject to Applicable Data Protection Laws (including EU GDPR, UK GDPR, and Swiss FADP).
        </p>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs text-xs space-y-1.5 text-neutral-600">
          <p><strong>&quot;Controller&quot;</strong> and <strong>&quot;Processor&quot;</strong> have the meanings given in GDPR Article 4.</p>
          <p><strong>&quot;Customer Personal Data&quot;</strong> means any personal data processed by Draftva on behalf of Customer in connection with the Service.</p>
          <p><strong>&quot;Standard Contractual Clauses (SCCs)&quot;</strong> means the standard contractual clauses approved by the European Commission pursuant to Commission Implementing Decision (EU) 2021/914.</p>
        </div>
      </div>
    ),
  },
  {
    id: "roles-instructions",
    number: "02",
    title: "Roles & Customer Instructions",
    content: (
      <div className="space-y-4">
        <p>
          The parties acknowledge and agree that with respect to Customer Personal Data:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-neutral-700 text-sm">
          <li><strong>Customer is the Controller</strong> (or a Processor acting on behalf of a third-party Controller).</li>
          <li><strong>Draftva is the Processor</strong> acting strictly on behalf of and in accordance with Customer&apos;s documented instructions.</li>
        </ul>
        <p className="text-sm text-neutral-700">
          Draftva shall process Customer Personal Data solely in accordance with Customer&apos;s documented lawful instructions as set forth in the Terms of Service, this DPA, and as configured through the platform UI (e.g., publishing schedules, member role designations).
        </p>
      </div>
    ),
  },
  {
    id: "confidentiality-personnel",
    number: "03",
    title: "Confidentiality & Security Controls",
    content: (
      <div className="space-y-4">
        <p>
          Draftva ensures that all personnel authorized to process Customer Personal Data are subject to appropriate statutory or contractual confidentiality obligations.
        </p>
        <div className="rounded-xl border border-black/[0.06] bg-[#f5fbf7] p-4 text-sm text-neutral-800 space-y-2">
          <p className="font-semibold text-neutral-900">Technical and Organizational Measures (TOMs):</p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-neutral-600">
            <li>End-to-end encryption in transit via TLS 1.3.</li>
            <li>Encryption at rest for all database tables, storage assets, and OAuth tokens using AES-256.</li>
            <li>Strict role-based access control (RBAC) and least-privilege administrative principles.</li>
            <li>Automated continuous monitoring, log auditing, and disaster recovery replication.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "subprocessors",
    number: "04",
    title: "Sub-processors",
    content: (
      <div className="space-y-4">
        <p>
          Customer provides general authorization for Draftva to engage third-party sub-processors to assist in delivering the Service. An up-to-date register of current sub-processors is maintained in our <a href="/subprocessors" className="text-[#0f7a47] font-semibold underline underline-offset-2">Sub-processors Directory</a>.
        </p>
        <p className="text-sm text-neutral-700">
          Draftva imposes data protection obligations on every sub-processor that are no less protective than those contained in this DPA. Draftva remains fully liable to Customer for the performance of each sub-processor&apos;s data protection duties.
        </p>
        <p className="text-sm text-neutral-700">
          Draftva will notify Customer at least 30 days prior to engaging any new sub-processor via an updated directory or email notice, giving Customer the opportunity to reasonably object on data protection grounds.
        </p>
      </div>
    ),
  },
  {
    id: "data-subject-requests",
    number: "05",
    title: "Data Subject Rights Assistance",
    content: (
      <div className="space-y-4">
        <p>
          To the extent Customer is unable to independently address a Data Subject Request (DSR) through self-service workspace controls (e.g., viewing, updating, or deleting content), Draftva shall provide reasonable technical assistance to help Customer fulfill its obligations under GDPR Chapter III.
        </p>
        <p className="text-sm text-neutral-700">
          If Draftva receives a request directly from a data subject regarding Customer Personal Data, Draftva will promptly notify Customer and advise the data subject to submit their request directly to Customer.
        </p>
      </div>
    ),
  },
  {
    id: "security-incident",
    number: "06",
    title: "Personal Data Breach Notification",
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs space-y-2">
          <p className="font-heading font-semibold text-neutral-900 text-sm">48-Hour Incident Notification</p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            In the event of a confirmed Personal Data Breach affecting Customer Personal Data, Draftva will notify Customer without undue delay and, where feasible, not later than 48 hours after becoming aware of the breach.
          </p>
          <p className="text-xs text-neutral-600 leading-relaxed">
            The notification will describe the nature of the incident, the likely consequences, and the mitigation steps taken or proposed by Draftva.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "international-transfers",
    number: "07",
    title: "International Data Transfers & SCCs",
    content: (
      <div className="space-y-4">
        <p>
          To the extent Customer Personal Data originating from the EEA, Switzerland, or the UK is transferred to countries that do not provide an adequate level of data protection, the parties agree that the European Commission&apos;s Standard Contractual Clauses (Module Two: Controller-to-Processor) are hereby incorporated by reference into this DPA.
        </p>
      </div>
    ),
  },
  {
    id: "deletion-return",
    number: "08",
    title: "Deletion and Return of Personal Data",
    content: (
      <div className="space-y-4">
        <p>
          Upon termination of your subscription or written request, Draftva shall delete or return all Customer Personal Data in its possession, unless retention is mandated by applicable statutory law. Deletion from backup archives occurs in the normal course of backup rotation within 30 days.
        </p>
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-2xs">
          <h3 className="font-heading font-semibold text-neutral-900">DPA Inquiries & Execution</h3>
          <p className="mt-1 text-sm text-neutral-600">
            For countersigned copies of this DPA or enterprise security questions:<br />
            Email: <a href="mailto:dpa@draftva.com" className="text-[#0f7a47] font-semibold">dpa@draftva.com</a>
          </p>
        </div>
      </div>
    ),
  },
];
