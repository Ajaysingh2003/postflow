import { AnswerSection } from "../component/AnswerSection";
import { ANSWER_PAGES } from "@/lib/seo/answers";
import React from "react";
import FinalCta from "../component/FinalCta";
import ReviewSection from "../component/ReviewSections";
import HeroSection from "../component/HeroSection";
import { HeroHeading } from "../component/TopHeader";
import McpSupport from "../component/McpSupport";

function McpView() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-7 lg:px-8">
      <HeroSection
        description={ANSWER_PAGES["/product/mcp"].summary}
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

      <AnswerSection path="/product/mcp" />
      <FinalCta />
    </div>
  );
}

export default McpView;
