import React from "react";
import type { Metadata } from "next";
import SubprocessorsView from "@/modules/legal/view/SubprocessorsView";

export const metadata: Metadata = {
  title: "Sub-processors Directory | Draftva",
  description:
    "View the complete list of cloud hosting, database, artificial intelligence, and payment sub-processors utilized by Draftva.",
};

export default function SubprocessorsPage() {
  return <SubprocessorsView />;
}
