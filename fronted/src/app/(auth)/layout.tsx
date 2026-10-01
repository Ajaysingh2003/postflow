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
    <div className="grid bg-primary grid-cols-1 md:grid-cols-12  ">
      <div className="col-span-12 md:col-span-6">
        {/* <InteractiveAuthScreen /> */}
        <ConnectionAnimation />
      </div>
      <div className="col-span-12 flex items-center justify-center w-full  p-3 md:col-span-6 rounded-lg  overflow-hidden">
        <div className="bg-background w-full border border-border rounded-xl shadow-sm ">
          <CardWrapper>{children}</CardWrapper>
        </div>
      </div>
    </div>
  );
}

export default layout;
