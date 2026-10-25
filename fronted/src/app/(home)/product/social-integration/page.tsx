import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import SocialIntigrationWiew from "@/modules/home/view/SocialIntigrationview";
import React from "react";

function page() {
  return (
    <>
      <PageSeo path="/product/social-integration" />
      <SocialIntigrationWiew />
    </>
  );
}

export default page;

export const metadata = seoMetadata("/product/social-integration");
