import { AnswerSection } from "../component/AnswerSection";
import { ANSWER_PAGES } from "@/lib/seo/answers";
import React from "react";
import HeroSection from "../component/HeroSection";
import ReviewSection from "../component/ReviewSections";
import { HeroHeading } from "../component/TopHeader";
import ScheduleFeatureSection from "../component/ScheduleFeatureSection";
import MultiChannelScheduleShowcase from "../component/MutliChannelShowcase";
import FinalCta from "../component/FinalCta";
import PricingOverviewHome from "../component/PricingOverview";

function ScheduleView() {
  return (
    <div className="max-w-[1280px] px-5 sm:px-7 lg:px-8   mx-auto">
      <HeroSection
        description={ANSWER_PAGES["/product/schedule"].summary}
        currentActive={3}
        header={
          <HeroHeading
            noColorText="Create"
            firstLine="Today."
            lastLine="Publish at the perfect moment."
          />
        }
      />
      <ReviewSection />
      <ScheduleFeatureSection />
      <PricingOverviewHome />
      <MultiChannelScheduleShowcase />
      <AnswerSection path="/product/schedule" />
      <FinalCta />
    </div>
  );
}

export default ScheduleView;
