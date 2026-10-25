import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React from "react";
import AcceptableUseView from "@/modules/legal/view/AcceptableUseView";

export default function AcceptableUsePage() {
  return (
    <>
      <PageSeo path="/acceptable-use" />
      <AcceptableUseView />
    </>
  );
}

export const metadata = seoMetadata("/acceptable-use");
