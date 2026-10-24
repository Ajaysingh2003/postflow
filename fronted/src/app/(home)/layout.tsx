import React from "react";
import { Footer } from "@/modules/home/component/Footer";
import Navbar from "@/components/base/Navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#faf9f5]">
      {/* Background Pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="grid-pattern h-full w-full" />
      </div>

      {/* Decorative Background Rings (z-0: strictly BEHIND all text, buttons, and cards) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* Left curved lines */}
        <div
          className="
            absolute
            top-[-140px]
            -left-[420px]
            h-[760px]
            w-[760px]
            rounded-full
            border-[24px]
            border-[#ebeae5]/70
          "
        />

        <div
          className="
            absolute
            top-[-110px]
            -left-[390px]
            h-[700px]
            w-[700px]
            rounded-full
            border
            border-[#deddd7]/60
          "
        />

        {/* Right curved lines */}
        <div
          className="
            absolute
            top-[390px]
            -right-[520px]
            h-[930px]
            w-[930px]
            rounded-full
            border-[22px]
            border-[#ebeae5]/70
          "
        />

        <div
          className="
            absolute
            top-[430px]
            -right-[470px]
            h-[840px]
            w-[840px]
            rounded-full
            border
            border-[#deddd7]/60
          "
        />
      </div>

      {/* Header / Navbar */}
      <div className="relative z-20">
        <Navbar />
      </div>

      {/* Main Content Area (z-10: always sits ON TOP of the rings) */}
      <main
        id="main-content"
        className="relative z-10 w-full flex-1 [&>div]:!bg-transparent [&_section]:!bg-transparent"
      >
        {children}
      </main>

      <div className="relative z-20">
        <Footer />
      </div>
    </div>
  );
}