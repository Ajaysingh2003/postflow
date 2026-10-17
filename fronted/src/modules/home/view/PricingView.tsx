"use client";

import React from "react";
import PricingSection from "@/modules/billing/component/PricingSection";
import PricingGuarantee from "@/modules/billing/component/PricingGuarantee";
import PricingComparisonTable from "@/modules/billing/component/PricingComparisonTable";
import PricingFaqSection from "@/modules/billing/component/PricingFaqSection";
import ReviewSection from "../component/ReviewSections";
import PricingOverviewHome from "../component/PricingOverview";
import FinalCta from "../component/FinalCta";

function PricingView() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-7 lg:px-8">
      {/* 1. Main Pricing Section with Tiers and Monthly/Quarterly/Annual switch */}
      <PricingSection />

      {/* 2. Trust and Security Guarantees */}
      <PricingGuarantee />

      {/* 3. Customer Testimonials & Social Proof */}
      <ReviewSection />

      {/* 4. Comprehensive Plan Comparison Matrix */}
      <PricingComparisonTable />

      {/* 5. Frequently Asked Questions Accordion */}
      <PricingFaqSection />

      {/* 6. Free-plan and billing information */}
      <div className="my-12">
        <PricingOverviewHome />
      </div>

      {/* 7. Final Call to Action */}
      <FinalCta />
    </div>
  );
}

export default PricingView;
