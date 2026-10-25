import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";

import React from "react";
import TermsView from "@/modules/legal/view/TermsView";

export default function TermsPage() {
  return (
    <>
      <PageSeo path="/terms" />
      <TermsView />
    </>
  );
}

export const metadata = seoMetadata("/terms");
