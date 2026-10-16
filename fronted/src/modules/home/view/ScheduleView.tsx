import React from "react";
import HeroSection from "../component/HeroSection";
import ReviewSection from "../component/ReviewSections";

function ScheduleView() {
  return (
    <div className="max-w-[1280px] px-5 sm:px-7 lg:px-8   mx-auto">
      <HeroSection />
      <ReviewSection />
    </div>
  );
}

export default ScheduleView;
