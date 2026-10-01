import React from "react";
// import Navbar from "@/modules/home/component/Navbar";
import { Footer } from "@/modules/home/component/Footer";
import Navbar from "@/components/base/Navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative bg-[#faf9f5] overflow-hidden min-h-screen w-full flex flex-col overflow-x-hidden">
      {/* Background Pattern (covers full page, doesn't block interactions) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="grid-pattern h-full w-full" />
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full flex items-center justify-center">
        <Navbar />
      </header>

      {/* Main Content Area */}
      <main className="relative z-0 flex-1 w-full">
        {children}
      </main>
      <Footer/>
    </div>
  );
}