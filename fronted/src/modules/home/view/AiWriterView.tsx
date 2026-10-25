import { AnswerSection } from "../component/AnswerSection";
import { ANSWER_PAGES } from "@/lib/seo/answers";
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
        description={ANSWER_PAGES["/product/ai-writer"].summary}
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
      <AnswerSection path="/product/ai-writer" />
      <FinalCta />
    </div>
  );
}

export default AiWriterView;
