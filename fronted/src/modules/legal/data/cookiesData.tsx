import React from "react";
import type { LegalSection } from "../types";

export const COOKIES_SECTIONS: LegalSection[] = [
  {
    id: "what-are-cookies",
    number: "01",
    title: "What Are Cookies & Local Storage?",
    content: (
      <div className="space-y-4">
        <p>
          Cookies are small text files that are stored on your computer, smartphone, or tablet when you visit websites. They are widely used by modern web applications to enable secure user authentication, remember user preferences, ensure site performance, and provide anonymous usage metrics.
        </p>
        <p>
          In addition to standard HTTP cookies, Draftva may use related web storage technologies such as <code>localStorage</code> and <code>sessionStorage</code> to store UI display state (e.g. sidebar collapse state, preferred editor theme, or dark mode toggle) directly on your client device.
        </p>
      </div>
    ),
  },
  {
    id: "categories",
    number: "02",
    title: "Categories of Cookies We Use",
    content: (
      <div className="space-y-4">
        <p>We classify the cookies used on Draftva into the following distinct functional categories:</p>
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">1. Strictly Necessary Cookies (Always Active)</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Essential for the core operation of Draftva. They enable you to log into your account, maintain active session state, navigate securely between workspace pages, and defend against Cross-Site Request Forgery (CSRF). The website cannot function without these cookies.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">2. Functional & Preference Cookies</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Allow Draftva to remember your custom preferences, such as selected workspace, active channel filter, text editor font size, and regional timezone settings for scheduling accuracy.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-2xs">
            <h3 className="font-heading font-semibold text-neutral-900">3. Performance & Diagnostic Cookies</h3>
            <p className="mt-1 text-sm text-neutral-600">
              Help us understand how users interact with the platform, detect JavaScript errors, diagnose latency in the publishing queue, and improve application loading speeds. All data collected is aggregated and anonymized.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "inventory",
    number: "03",
    title: "Cookie Inventory Table",
    content: (
      <div className="space-y-4">
        <p>The table below provides a detailed breakdown of the specific cookies set by Draftva:</p>
        <div className="overflow-x-auto rounded-xl border border-black/[0.08] bg-white shadow-2xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50/80 font-subheading text-xs uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="p-3.5">Cookie Name</th>
                <th className="p-3.5">Provider</th>
                <th className="p-3.5">Purpose</th>
                <th className="p-3.5">Duration</th>
                <th className="p-3.5">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-700">
              <tr>
                <td className="p-3.5 font-mono text-xs font-semibold text-neutral-900">draftva_session</td>
                <td className="p-3.5">Draftva</td>
                <td className="p-3.5">Encrypted JWT user authentication and session identifier</td>
                <td className="p-3.5">30 days</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Necessary</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-mono text-xs font-semibold text-neutral-900">draftva_csrf</td>
                <td className="p-3.5">Draftva</td>
                <td className="p-3.5">Cross-Site Request Forgery protection for API mutations</td>
                <td className="p-3.5">Session</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Necessary</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-mono text-xs font-semibold text-neutral-900">draftva_workspace</td>
                <td className="p-3.5">Draftva</td>
                <td className="p-3.5">Stores the ID of the currently selected active workspace</td>
                <td className="p-3.5">1 year</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Functional</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-mono text-xs font-semibold text-neutral-900">__dodopayment_mid / __dodopayment_sid</td>
                <td className="p-3.5">dodopayment</td>
                <td className="p-3.5">Fraud prevention and payment verification during checkout</td>
                <td className="p-3.5">1 year / 30 min</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Necessary</span></td>
              </tr>
              <tr>
                <td className="p-3.5 font-mono text-xs font-semibold text-neutral-900">theme_preference</td>
                <td className="p-3.5">Draftva</td>
                <td className="p-3.5">Stores your light/dark mode UI display preference</td>
                <td className="p-3.5">1 year</td>
                <td className="p-3.5"><span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Functional</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ),
  },
  {
    id: "managing-cookies",
    number: "04",
    title: "How to Manage and Disable Cookies",
    content: (
      <div className="space-y-4">
        <p>
          You have the right to decide whether to accept or reject cookies. Most modern browsers allow you to change your cookie settings through their preferences or settings menus.
        </p>
        <div className="rounded-xl border border-black/[0.06] bg-[#f5fbf7] p-4 text-sm text-neutral-800">
          <p className="font-semibold text-neutral-900">Important Note on Essential Cookies:</p>
          <p className="mt-1 text-neutral-600">
            Because strictly necessary cookies are required to authenticate your identity and protect against CSRF attacks, blocking them via browser configuration will prevent you from signing in or scheduling posts on Draftva.
          </p>
        </div>
        <p className="text-sm text-neutral-700">
          For guidance on how to manage cookies on major web browsers:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-xs text-neutral-600">
          <li><strong>Google Chrome:</strong> Settings &gt; Privacy and security &gt; Cookies and other site data</li>
          <li><strong>Apple Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
          <li><strong>Mozilla Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
          <li><strong>Microsoft Edge:</strong> Settings &gt; Cookies and site permissions &gt; Manage and delete cookies</li>
        </ul>
      </div>
    ),
  },
  {
    id: "contact",
    number: "05",
    title: "Questions & Policy Updates",
    content: (
      <div className="space-y-4">
        <p>
          We may update this Cookie Policy from time to time to reflect changes in our operational technologies or applicable legal requirements. The &quot;Last Updated&quot; date at the top of this document indicates when the latest modifications took effect.
        </p>
        <p>
          For any questions concerning our use of cookies or tracking technologies, please contact <a href="mailto:privacy@draftva.com" className="text-[#0f7a47] font-semibold underline underline-offset-2">privacy@draftva.com</a>.
        </p>
      </div>
    ),
  },
];
