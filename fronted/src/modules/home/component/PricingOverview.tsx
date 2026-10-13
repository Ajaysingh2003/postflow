import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
function PricingOverviewHome() {
  return (
    <div className="w-full primary-box h-full py-8 md:py-16 bg-[#3fda8a] rounded-xl shadow-lg px-6 md:px-8">
      <div className="flex  flex-col md:flex-row justify-between items-center gap-2">
        <div className="space-y-3">
          <h2 className="font-headinzg text-white text-left text-[30px] leading-[33px] sm:text-[48px] sm:leading-[52.8px]  font-bold font-[700]">
            Ready to get started?
          </h2>
          <p className="text-white max-w-[620px] text-white text-left text-[18px] leading-[23.44px] sm:text-[22px] sm:leading-[28.64px] font-[400]">
            Connect your channels and schedule your first post in minutes. Your
            first 3 days cost $0.
          </p>
        </div>

        <div className="flex  order-2  gap-2 items-center justify-center">
          <Image
            alt="point out"
            src={"/point-out.svg"}
            height={100}
            width={100}
          />
          <Button className="secondary-btn size-lg capitalize order-1  rounded-full font-medium !py-6 !px-8 !text-xl ">
            start for 0$
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PricingOverviewHome;
