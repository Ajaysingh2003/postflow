
import React from "react";
import type { Metadata } from "next";
import TermsView from "@/modules/legal/view/TermsView";

export const metadata: Metadata = {
  title: "Terms of Service | Draftva",
  description:
    "Read the Terms of Service for Draftva. Learn about your rights, subscription terms, content ownership, and official API integration rules.",
};

export default function TermsPage() {
  return <TermsView />;
}
