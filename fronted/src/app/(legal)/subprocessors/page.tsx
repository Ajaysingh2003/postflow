import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import React from "react";
import SubprocessorsView from "@/modules/legal/view/SubprocessorsView";

export default function SubprocessorsPage() {
  return (
    <>
      <PageSeo path="/subprocessors" />
      <SubprocessorsView />
    </>
  );
}

export const metadata = seoMetadata("/subprocessors");
