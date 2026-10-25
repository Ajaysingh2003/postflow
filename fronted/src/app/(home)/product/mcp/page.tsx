import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import McpView from "@/modules/home/view/McpView";
import React from "react";

function page() {
  return (
    <>
      <PageSeo path="/product/mcp" />
      <McpView />
    </>
  );
}

export default page;
export const metadata = seoMetadata("/product/mcp");
