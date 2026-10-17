import React from 'react'
import HeroSection from '../component/HeroSection'
import { HeroHeading } from '../component/TopHeader'
import ReviewSection from '../component/ReviewSections'
import FinalCta from '../component/FinalCta'
import PricingSection from "@/modules/billing/component/PricingSection";
function PricingView() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 sm:px-7 lg:px-8">
      <PricingSection/>
      <FinalCta />  
    </div>
  )
}

export default PricingView