import { AnswerSection } from "../component/AnswerSection";
import { ANSWER_PAGES } from "@/lib/seo/answers";
import React from "react";
import HeroSection from "../component/HeroSection";
import { HeroHeading } from "../component/TopHeader";
import ReviewSection from "../component/ReviewSections";
import AnalyticsFeatureSection from "../component/AnalyticsFeatureSection";
import AnalyticsShowcase from "../component/AnalyticsShowcase";
import PricingOverviewHome from "../component/PricingOverview";
import FinalCta from "../component/FinalCta";

function AnalyticsView() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-7 lg:px-8">
      <HeroSection
        description={ANSWER_PAGES["/product/analytics"].summary}
        currentActive={4}
        header={
          <HeroHeading
            noColorText="Track"
            firstLine="What works."
            lastLine="Double down on what grows."
          />
        }
      />

      <ReviewSection />
      <AnalyticsFeatureSection />
      <PricingOverviewHome />
      <AnalyticsShowcase />
      <AnswerSection path="/product/analytics" />
      <FinalCta />
    </div>
  );
}

export default AnalyticsView;
