"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface Company {
  name: string;
  category: string;
  logo: React.ReactNode;
}

const companies: Company[] = [
  {
    name: "Kajabi",
    category: "Creator Commerce & Courses",
    logo: (
      <svg
        className="size-8 -4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-8 -4.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3 3h4.6v7.4L14.8 3H21l-8.6 8.8L21 21h-6.2l-7.2-7.6V21H3V3z" />
      </svg>
    ),
  },
  {
    name: "Substack",
    category: "Media & Video Newsletters",
    logo: (
      <svg
        className="size-8 -4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-8 -4.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M22.5 3.5H1.5V6.7h21V3.5zM1.5 8.9h21v3.2H1.5V8.9zm0 5.4h21v6.2L12 15.2 1.5 20.5v-6.2z" />
      </svg>
    ),
  },
  {
    name: "Maven",
    category: "Cohort-Based Learning",
    logo: (
      <svg
        className="size-8 -4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-8 -4.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M2.5 4h3.8l5.7 8.5L17.7 4h3.8v16h-3.8V9.5l-5.7 8.5-5.7-8.5V20H2.5V4z" />
      </svg>
    ),
  },
  {
    name: "Circle",
    category: "Community Video Hubs",
    logo: (
      <svg
        className="size-8 -4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-8 -4.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    ),
  },
  {
    name: "Teachable",
    category: "Educational Video Academies",
    logo: (
      <svg
        className="size-8 -4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-8 -4.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3 4h18v4H14.5v12h-5V8H3V4z" />
      </svg>
    ),
  },
  {
    name: "Skool",
    category: "Gamified Learning Groups",
    logo: (
      <svg
        className="size-8 -4 shrink-0 transition-transform duration-200 group-hover:scale-110 sm:size-8 -4.5"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2a10 10 0 1 0 10 10A10.01 10.01 0 0 0 12 2zm1 14.8h-2v-2h2zm0-4h-2V7h2z" />
      </svg>
    ),
  },
];

export default function CompanyProof() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={
        reducedMotion
          ? false
          : {
              opacity: 0,
              y: 12,
              filter: "blur(4px)",
            }
      }
      animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{
        delay: 0.35,
        duration: 0.75,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="mt-10 border-t border-black/[0.06] pt-6 sm:mt-14"
    >
      {/* Header Pill & Label */}
      <div className="mb-5 flex items-center gap-2.5 sm:mb-6">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#B3E61D] opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-[#B3E61D] shadow-[0_0_8px_rgba(179,230,29,0.8)]" />
        </span>

        <p className="font-heading text-xs font-semibold uppercase tracking-[0.08em] text-[#85887e]">
          Trusted by high-throughput video platforms &amp; academies
        </p>
      </div>

      {/* Grid of Verified Companies */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 sm:gap-x-11 sm:gap-y-5">
        {companies.map((company) => (
          <div
            key={company.name}
            title={`${company.name} — ${company.category}`}
            className="group flex cursor-default select-none items-center gap-2.5 py-1 text-[#787a71] transition-colors duration-200 hover:text-[#11120e]"
          >
            <span className="text-[#969990] transition-colors duration-200 group-hover:text-[#11120e]">
              {company.logo}
            </span>

            <span className="font-heading text-base font-semibold tracking-[-0.03em] text-[#6d7066] transition-colors duration-200 group-hover:text-[#11120e] sm:text-lg">
              {company.name}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}