import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React from "react";
import PrivacyView from "@/modules/legal/view/PrivacyView";

export default function PrivacyPage() {
  return (
    <>
      <PageSeo path="/privacy" />
      <PrivacyView />
    </>
  );
}

export const metadata = seoMetadata("/privacy");
