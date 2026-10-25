import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React from "react";
import CookiesView from "@/modules/legal/view/CookiesView";

export default function CookiesPage() {
  return (
    <>
      <PageSeo path="/cookies" />
      <CookiesView />
    </>
  );
}

export const metadata = seoMetadata("/cookies");
