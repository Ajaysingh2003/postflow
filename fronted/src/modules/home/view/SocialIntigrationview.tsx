import { AnswerSection } from "../component/AnswerSection";
import { ANSWER_PAGES } from "@/lib/seo/answers";
import React from "react";
import HeroSection from "../component/HeroSection";
import { HeroHeading } from "../component/TopHeader";
import ReviewSection from "../component/ReviewSections";
import PricingOverviewHome from "../component/PricingOverview";
import FinalCta from "../component/FinalCta";
import Intigration from "../component/Intigration";

function SocialIntigrationWiew() {
  return (
    <div className="max-w-[1280px] px-5 sm:px-7 lg:px-8   mx-auto">
      <HeroSection
        description={ANSWER_PAGES["/product/social-integration"].summary}
        currentActive={1}
        header={
          <HeroHeading
            noColorText="Connect"
            firstLine="Once."
            lastLine="Publish across every channel."
          />
        }
      />
      <ReviewSection />

      <PricingOverviewHome />

      <Intigration />
      <AnswerSection path="/product/social-integration" />
      <FinalCta />
    </div>
  );
}

export default SocialIntigrationWiew;
