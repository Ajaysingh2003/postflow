import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import AiWriterView from "@/modules/home/view/AiWriterView";
import React from "react";

function page() {
  return (
    <>
      <PageSeo path="/product/ai-writer" />
      <AiWriterView />
    </>
  );
}

export default page;
export const metadata = seoMetadata("/product/ai-writer");
