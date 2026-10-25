import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React from "react";
import LegalHubView from "@/modules/legal/view/LegalHubView";

export default function LegalPage() {
  return (
    <>
      <PageSeo path="/legal" />
      <LegalHubView />
    </>
  );
}

export const metadata = seoMetadata("/legal");
