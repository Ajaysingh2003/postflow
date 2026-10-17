import React from "react";
import HeroSection from "../component/HeroSection";
import { HeroHeading } from "../component/TopHeader";
import ReviewSection from "../component/ReviewSections";
import FinalCta from "../component/FinalCta";

function AnalyticsView() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-7 lg:px-8">
      <HeroSection
        description="Connect Draftva directly to Claude, Cursor, and your favorite AI agents via MCP. Draft, schedule, and manage your X, LinkedIn, and Threads queues right from your prompt window."
        currentActive={4}
        header={
          <HeroHeading
            noColorText="Prompt"
            firstLine="Once."
            lastLine="Publish straight from your AI."
          />
        }
      />
      <ReviewSection />
      <FinalCta />
    </div>
  );
}

export default AnalyticsView;
