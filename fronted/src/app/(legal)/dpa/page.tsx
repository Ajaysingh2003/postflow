import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React from "react";
import DpaView from "@/modules/legal/view/DpaView";

export default function DpaPage() {
  return (
    <>
      <PageSeo path="/dpa" />
      <DpaView />
    </>
  );
}

export const metadata = seoMetadata("/dpa");
