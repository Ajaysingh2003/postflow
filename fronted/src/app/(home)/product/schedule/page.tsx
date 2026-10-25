import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import ScheduleView from "@/modules/home/view/ScheduleView";
import React from "react";

function page() {
  return (
    <>
      <PageSeo path="/product/schedule" />
      <ScheduleView />
    </>
  );
}

export default page;
export const metadata = seoMetadata("/product/schedule");
