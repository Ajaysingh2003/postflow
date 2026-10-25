import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import AnalyticsView from "@/modules/home/view/AnalyticsView";
import React from "react";

function page() {
  return (
    <>
      <PageSeo path="/product/analytics" />
      <AnalyticsView />
    </>
  );
}

export default page;
export const metadata = seoMetadata("/product/analytics");
