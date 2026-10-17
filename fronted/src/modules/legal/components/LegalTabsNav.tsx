"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { LayoutGrid } from "lucide-react";

export function LegalTabsNav() {
  const pathname = usePathname();

  return (
    <div className="w-full border-b border-black/[0.06] bg-white/60 backdrop-blur-md sticky top-[60px] z-30">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar"
          aria-label="Legal document tabs"
        >
          <Link
            href="/legal"
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200",
              pathname === "/legal"
                ? "bg-[#11120e] text-white shadow-xs"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.04]"
            )}
          >
            <LayoutGrid className="size-3.5" />
            <span>Overview</span>
          </Link>

          {LEGAL_DOCS.map((doc) => {
            const isActive =
              pathname === doc.slug ||
              pathname === `${doc.slug}/` ||
              (doc.id === "terms" && pathname.startsWith("/terms")) ||
              (doc.id === "privacy" && pathname.startsWith("/privacy")) ||
              (doc.id === "cookies" && pathname.startsWith("/cookies")) ||
              (doc.id === "acceptable-use" && pathname.startsWith("/acceptable-use")) ||
              (doc.id === "dpa" && pathname.startsWith("/dpa")) ||
              (doc.id === "subprocessors" && pathname.startsWith("/subprocessors"));

            return (
              <Link
                key={doc.id}
                href={doc.slug}
                className={cn(
                  "inline-flex items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#3fda8a] text-neutral-950 font-semibold shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.04]"
                )}
              >
                <span>{doc.shortTitle}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
