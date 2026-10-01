"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FeatureCardOne } from "./FeatureCardOne";
import { FeatureCardTwo } from "./FeatureCardTwo";
import { FeatureCardFour } from "./FeatureCardFour";
import { FeatureCardThree } from "./FeatureCardThree";
import { FeatureCardFive } from "./FeatureCardFive";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import FeatureCardTitlt from "./FeatureCardTitlt";
import FeatureCardSixth from "./FeatureCardSixth";
import {FeatureCardNormal} from "./FeatureCardNormal";
import FeatureCardTilt from "./FeatureCardTitlt";

/* -------------------------------------------------------------------------- */
/* Main Feature Section                                                       */
/* -------------------------------------------------------------------------- */
const HIGHLIGHTS = [
  { text: "encode faster", key: "encode" },
  { text: "deliver globally", key: "edge" },
  { text: "track every frame", key: "telemetry" },
];

export default function FeatureSection() {
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % HIGHLIGHTS.length);
    }, 2600);

    return () => clearInterval(timer);
  }, [reducedMotion]);

  const muted =
    "text-[#a5a79f] transition-colors duration-300 hover:text-[#5d6057]";

  const active = "text-[#171914] font-semibold";

  return (
    <section className="relative w-full overflow-hidden  py-12 zsm:px-8 sm:py-16 zlg:px-12 lg:py-20
   
    ">
      <div className="relative mx-auto max-w-6xlz">
        {/* Header */}
        <div className="mb-8 max-w-2xl select-none sm:mb-10 lg:mb-12">
          <div className="mb-3 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[#B3E61D]" />

            <span className="font-subheading text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8c8f86]">
              Video infrastructure
            </span>
          </div>

          <h2 className="font-heading text-[22px] font-medium leading-[1.35] tracking-[-0.02em] sm:text-[26px] md:text-[27px] lg:text-[36px]">
            <span className={activeStep === 0 ? active : muted}>
              Encode once,{" "}
            </span>

            <span className="relative inline-block">
              <motion.span
                key={HIGHLIGHTS[activeStep].key}
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 4,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.25,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative z-10 px-1 font-semibold text-[#171914]"
              >
                {HIGHLIGHTS[activeStep].text}
              </motion.span>

              <span className="absolute inset-x-0 bottom-[2px] h-[7px] rounded-[3px] bg-[#B3E61D]/80" />
            </span>

            <span className={activeStep === 1 ? active : muted}>
              {" "}
              through a global edge network{" "}
            </span>

            <span className={activeStep === 2 ? active : muted}>
              with real-time playback data.
            </span>
          </h2>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
            <FeatureCardOne />
            <FeatureCardFour />
            <FeatureCardSixth />
          </div>

          <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
            <FeatureCardTwo />
            <FeatureCardThree />
            <FeatureCardTilt/>
            <FeatureCardNormal/>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <FeatureCardFive />
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared Components                                                          */
/* -------------------------------------------------------------------------- */

export function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-black/[0.08] bg-white shadow-sm hover:border-black/[0.12] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}

export function BentoHeader({
  icon: Icon,
  iconBg = "bg-neutral-100 text-neutral-700",
  badge,
  title,
  description,
  linkText,
  liveDot = false,
}: {
  icon: React.ElementType;
  iconBg?: string;
  badge?: string;
  title: string;
  description: string;
  linkText?: string;
  liveDot?: boolean;
}) {
  return (
    <div className="p-6 sm:p-7 space-y-3">
      <div className="flex items-center justify-between">
        <div
          className={`flex size-8 items-center justify-center rounded-lg shadow-2xs ${iconBg}`}
        >
          <Icon className="size-4" />
        </div>

        {badge && (
          <span className="font-subheading rounded-full border border-neutral-200/90 bg-neutral-50/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {badge}
          </span>
        )}
      </div>

      <div>
        <h3 className="font-heading text-lg sm:text-2xl font-semibold tracking-tight capitalize text-foreground flex items-center gap-2">
          <span>{title}</span>
          {liveDot && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
          )}
        </h3>
        <p className="mt-1 text-sm sm:text-base text-neutral-500 leading-relaxed">
          {description}
        </p>
      </div>

      {linkText && (
        <div className="pt-0.5">
          <Link
            href={linkText}
            className="font-subheading inline-flex items-center justify-center whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary-link text-xs sm:text-sm underline-offset-4 hover:text-primary-link-hover hover:underline rounded-lg font-semibold p-0 h-auto"
          >
            {linkText}
          </Link>
        </div>
      )}
    </div>
  );
}
export function CardBottomFade({ height = "h-28" }: { height?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 ${height} z-30`}
      style={{
        background:
          "radial-gradient(ellipse 90% 100% at 50% 100%, #ffffff 40%, rgba(255,255,255,0.7) 65%, transparent 100%)",
      }}
    />
  );
}

// export function CardBottomFade({ height = "h-20" }: { height?: string }) {
//   return (
//     <div
//       aria-hidden="true"
//       className={`pointer-events-none absolute inset-x-0 bottom-0 ${height} bg-gradient-to-t from-white via-white/80 to-transparent z-20`}
//     />
//   );
// }
