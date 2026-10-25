import dynamic from "next/dynamic";
import React from "react";
import { HeroHeading } from "../component/TopHeader";
import HeroSection from "../component/HeroSection";
const FeatureSection = dynamic(() => import("../component/FeatureSection"));

import PricingSection from "@/modules/billing/component/PricingSection";
import ReviewSection from "../component/ReviewSections";
import FinalCta from "../component/FinalCta";
const Intigration = dynamic(() => import("../component/Intigration"));
const McpSupport = dynamic(() => import("../component/McpSupport"));
import PricingOverviewHome from "../component/PricingOverview";

function HomeView({ pricingSection }: { pricingSection?: React.ReactNode }) {
  return (
    <div className="w-full  bg-[#faf9f5]  h-full  min-h-screen  zlg:pt-5 relative">
      <div className="max-w-[1280px] px-5 sm:px-7 lg:px-8   mx-auto">
        <HeroSection
          description="From your first idea to your next viral post. Create, schedule,
        and grow across LinkedIn, X, and Threads — all from one
        intelligent workspace."
          header={
            <HeroHeading
              noColorText="The"
              firstLine="AI-powered"
              lastLine="engine for content & growth."
            />
          }
        />

        <ReviewSection />
        <FeatureSection />
        <PricingOverviewHome />
        <Intigration />
        <McpSupport />
        {pricingSection ?? <PricingSection />}
        <FinalCta />
      </div>
    </div>
  );
}

export default HomeView;
