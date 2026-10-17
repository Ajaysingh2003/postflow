import React from "react";
import type { Metadata } from "next";
import PrivacyView from "@/modules/legal/view/PrivacyView";

export const metadata: Metadata = {
  title: "Privacy Policy | Draftva",
  description:
    "Learn how Draftva collects, stores, protects, and handles personal data and encrypted OAuth credentials in compliance with GDPR and CCPA.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyView />;
}
