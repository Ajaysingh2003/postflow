import React from "react";
import { HeroHeading } from "../component/TopHeader";
import HeroSection from "../component/HeroSection";
import ReviewSection from "../component/ReviewSections";
import PricingOverviewHome from "../component/PricingOverview";
import FinalCta from "../component/FinalCta";
import AiWriterFeature from "../component/AiWriterFeature";
import WriterShowcase from "../component/WriterShowcase";

function AiWriterView() {
  return (
    <div className="max-w-[1280px] px-5 sm:px-7 lg:px-8   mx-auto">
      <HeroSection
        description="From your first thought to your next standout post. Write, refine, and create engaging content with AI for LinkedIn, X, and Threads — all from one intelligent workspace."
        currentActive={2}
        header={
          <HeroHeading
            noColorText="Think it."
            firstLine="Write it."
            lastLine="Perfect it with AI."
          />
        }
      />
      <ReviewSection />

      <AiWriterFeature />
      <PricingOverviewHome />
      <WriterShowcase />
      <FinalCta />
    </div>
  );
}

export default AiWriterView;
