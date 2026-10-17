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
        description="Stop guessing what resonates. Track true reach, engagement velocity, and breakout posts across LinkedIn, X, and Threads — with official API telemetry all in one real-time command center."
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
      <FinalCta />
    </div>
  );
}

export default AnalyticsView;
