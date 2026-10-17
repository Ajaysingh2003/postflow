import React from "react";
import type { Metadata } from "next";
import LegalHubView from "@/modules/legal/view/LegalHubView";

export const metadata: Metadata = {
  title: "Legal & Compliance Hub | Draftva",
  description:
    "Explore Draftva's legal documentation, including Terms of Service, Privacy Policy, Cookie Policy, Acceptable Use, DPA, and Sub-processors.",
};

export default function LegalPage() {
  return <LegalHubView />;
}
