import React from "react";
import FinalCta from "../component/FinalCta";
import PricingOverviewHome from "../component/PricingOverview";
import ReviewSection from "../component/ReviewSections";
import HeroSection from "../component/HeroSection";
import { HeroHeading } from "../component/TopHeader";
import McpSupport from "../component/McpSupport";

function McpView() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-7 lg:px-8">
      <HeroSection
        description="Connect Draftva directly to Claude, Cursor, and your favorite AI agents via MCP. Draft, schedule, and manage your X, LinkedIn, and Threads queues right from your prompt window."
        currentActive={0}
        header={
          <HeroHeading
            noColorText="Prompt"
            firstLine="Once."
            lastLine="Publish straight from your AI."
          />
        }
      />
      <ReviewSection />
      <McpSupport />

      <FinalCta />
    </div>
  );
}

export default McpView;