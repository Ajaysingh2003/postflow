import InteractiveAuthScreen from "@/modules/micro-interactions/Authanimation";
import React from "react";
import type { Metadata } from "next";
import { CardWrapper } from "@/components/base/AuthCardWrapper";
import ConnectionAnimation from "@/modules/micro-interactions/ConnectionAnimation";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

function layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid bg-primary ">
      
      <div className="flex items-center justify-center w-full  overflow-hidden">
        <div className=" w-full border border-border rounded-xl shadow-sm ">
          <CardWrapper>{children}</CardWrapper>
        </div>
      </div>
    </div>
  );
}

export default layout;
