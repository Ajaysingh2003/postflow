import React from 'react'
import HeroSection from '../component/HeroSection'
import { HeroHeading } from '../component/TopHeader'
import ReviewSection from '../component/ReviewSections'
import ScheduleFeatureSection from '../component/ScheduleFeatureSection'
import PricingOverviewHome from '../component/PricingOverview'
import MultiChannelScheduleShowcase from '../component/MutliChannelShowcase'
import FinalCta from '../component/FinalCta'
import Intigration from '../component/Intigration'

function SocialIntigrationWiew() {
  return (
   <div className="max-w-[1280px] px-5 sm:px-7 lg:px-8   mx-auto">
      <HeroSection description="Link your X, LinkedIn, Threads, and brand pages in one click—no tab-switching or copy-pasting required." currentActive={1} header={<HeroHeading
  noColorText="Connect"
  firstLine="Once."
  lastLine="Publish across every channel."
/>} />
      <ReviewSection />

      <PricingOverviewHome />

        <Intigration/>
      <FinalCta/> 
    </div>
  )
}

export default SocialIntigrationWiew