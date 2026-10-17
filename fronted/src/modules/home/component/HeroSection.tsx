import React from "react";
import TopHeader from "./TopHeader";
import VideoInfraIllustration from "./VideoInfraIllustration";

function HeroSection({ header , currentActive ,description}: { header: React.ReactNode ,currentActive?:number,description:string }) {
  return (
    <div className=" relative  w-full min-h-screen  mt-10 md:mt-6  h-full">
      <TopHeader header={header} description={description} />
      <VideoInfraIllustration currentActive={currentActive ||0} />
    </div>
  );
}

export default HeroSection;
