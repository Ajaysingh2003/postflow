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
      <HeroSection description="From your first draft to your next big post. Plan, schedule, and publish at the perfect time across LinkedIn, X, and Threads — all from one intelligent workspace." currentActive={3} header={<HeroHeading noColorText="Create"  firstLine="Today." lastLine="Publish at the perfect moment." />} />
      <ReviewSection />
      <ScheduleFeatureSection/>
      <PricingOverviewHome />
      <MultiChannelScheduleShowcase/>
      <FinalCta/> 
    </div>
    
  );
}

export default ScheduleView;
