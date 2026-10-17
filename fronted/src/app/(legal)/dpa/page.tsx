import React from "react";
import type { Metadata } from "next";
import DpaView from "@/modules/legal/view/DpaView";

export const metadata: Metadata = {
  title: "Data Processing Addendum (DPA) | Draftva",
  description:
    "Review Draftva's GDPR Article 28 compliant Data Processing Addendum, technical and organizational measures (TOMs), and EU Standard Contractual Clauses.",
};

export default function DpaPage() {
  return <DpaView />;
}
