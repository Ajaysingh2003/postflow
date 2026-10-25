import { PageSeo } from "@/lib/seo/PageSeo";
import { seoMetadata } from "@/lib/seo/config";
import AboutView from "@/modules/home/view/AboutView";

export default function AboutPage() {
  return (
    <>
      <PageSeo path="/about" />
      <AboutView />
    </>
  );
}

export const metadata = seoMetadata("/about");
