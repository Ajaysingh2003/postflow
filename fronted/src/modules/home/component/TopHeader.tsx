"use client";

import React from "react";
import { Check, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import CtaSection from "./CtaSection";
import CompanyProof from "./CompanyProof";

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

const EASE = [0.16, 1, 0.3, 1] as const;

const proofItems = [
  "AI-powered writing",
  "Smart scheduling",
  "Content analytics",
];

interface BlurWordProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  reducedMotion?: boolean;
}

function BlurWord({
  children,
  delay = 0,
  duration = 0.85,
  className = "",
  reducedMotion = false,
}: BlurWordProps) {
  return (
    <motion.span
      initial={false}
      animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{
        duration: reducedMotion ? 0 : duration,
        delay: reducedMotion ? 0 : delay,
        ease: EASE,
      }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.span>
  );
}

interface BlurTextProps {
  text: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  className?: string;
  reducedMotion?: boolean;
}

function BlurText({
  text,
  delay = 0,
  stagger = 0.075,
  duration = 0.85,
  className = "",
  reducedMotion = false,
}: BlurTextProps) {
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <BlurWord
            delay={delay + index * stagger}
            duration={duration}
            reducedMotion={reducedMotion}
          >
            {word}
          </BlurWord>

          {index < words.length - 1 && " "}
        </React.Fragment>
      ))}
    </span>
  );
}

interface FadeBlurProps {
  visibleOnServer?: boolean;
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  blur?: number;
  className?: string;
  reducedMotion?: boolean;
}

function FadeBlur({
  visibleOnServer = false,
  children,
  delay = 0,
  duration = 0.8,
  y = 16,
  blur = 8,
  className = "",
  reducedMotion = false,
}: FadeBlurProps) {
  return (
    <motion.div
      initial={
        visibleOnServer || reducedMotion
          ? false
          : {
              opacity: 0,
              y,
              filter: `blur(${blur}px)`,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{
        duration: reducedMotion ? 0 : duration,
        delay: reducedMotion ? 0 : delay,
        ease: EASE,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function TopHeader({
  header,
  description,
}: {
  header: React.ReactNode;
  description: string;
}) {
  const reducedMotion = useReducedMotion() === true;

  return (
    <section className="relative isolate w-full overflow-hidden text-[#11120e]">
      {/* ------------------------------------------------------------------ */}
      {/* Decorative background                                              */}
      {/* ------------------------------------------------------------------ */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/* Subtle top glow */}

        <div
          className="
            absolute
            left-[18%]
            top-[-280px]
            h-[520px]
            w-[720px]
            rounded-full
            bg-[#B3E61D]/[0.08]
            blur-[130px]
          "
        />

        {/* Left curved lines */}

        {/* Bottom fade */}

        {/* <div
          className="
            absolute
            inset-x-0
            bottom-0
            h-56
            bg-gradient-to-b
            from-transparent
            to-[#faf9f5]
          "
        /> */}
      </div>

      <div className="mx-auto w-full">
        <div className="pt-16 sm:pt-20 lg:pt-[118px]">
          <div className="max-w-[930px]">
            <FadeBlur
              visibleOnServer
              delay={0.68}
              duration={1}
              y={18}
              blur={10}
              reducedMotion={reducedMotion}
            >
              {header}
            </FadeBlur>
            <FadeBlur
              visibleOnServer
              delay={0.68}
              duration={1}
              y={18}
              blur={10}
              reducedMotion={reducedMotion}
            >
              <p
                className="
                  mt-7
                  max-w-[670px]
                  font-content
                  text-[16px]
                  leading-[1.65]
                  tracking-[-0.015em]
                  text-[#6d6e68]
                  sm:text-[18px]
                "
              >
                {description}
              </p>
            </FadeBlur>

            <FadeBlur
              delay={0.85}
              duration={0.85}
              y={18}
              blur={6}
              reducedMotion={reducedMotion}
              className="mt-7"
            >
              <CtaSection />

              <CompanyProof />
            </FadeBlur>

            <FadeBlur
              delay={1.05}
              duration={0.85}
              y={12}
              blur={5}
              reducedMotion={reducedMotion}
            >
              <div
                className="
                  mt-7
                  flex
                  flex-wrap
                  items-center
                  gap-x-5
                  gap-y-2.5
                  text-[12px]
                  font-medium
                  text-[#8a8c84]
                "
              >
                {proofItems.map((item) => (
                  <div
                    key={item}
                    className="
                      flex
                      items-center
                      gap-1.5
                      text-[16px]
                      sm:text-[16px]
                    "
                  >
                    <Check className="size-3.5 shrink-0 text-[#7d9c1a]" />

                    <span>{item}</span>
                  </div>
                ))}

                {/* Separator */}

                <div className="hidden h-3 w-px bg-black/10 sm:block" />

                {/* Trust signal */}

                <div
                  className="flex text-[16px]
                      sm:text-[16px] items-center gap-1.5"
                >
                  <ShieldCheck className="size-3.5 shrink-0 text-[#7d9c1a]" />

                  <span>No credit card required</span>
                </div>
              </div>
            </FadeBlur>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Product preview                                                  */}
          {/* ---------------------------------------------------------------- */}

          <motion.div
            initial={
              reducedMotion
                ? false
                : {
                    opacity: 0,
                    y: 42,
                    scale: 0.985,
                    filter: "blur(8px)",
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
            }}
            transition={{
              delay: reducedMotion ? 0 : 0.95,
              duration: reducedMotion ? 0 : 1,
              ease: EASE,
            }}
            className="relative mt-6 sm:mt-6 lg:mt-[34px]"
          >
            {/* Small testimonial/status line */}

            <div
              className="
                mb-4
                flex
                flex-wrap
                items-center
                gap-x-3
                gap-y-2
                max-w-[270px] md:max-w-full
                text-[12px]
                text-[#50514f]
                sm:text-[14px]
              "
            >
              {/* Stars */}

              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={index} className="text-[#8a8c83]">
                    ★
                  </span>
                ))}
              </div>

              {/* Separator */}

              <span className="hidden text-black/15 sm:inline">•</span>

              {/* Description */}

              <span>
                Everything you need to create, publish, and grow your personal
                brand.
              </span>
            </div>

            {/* Background shadow plate */}

            <div
              aria-hidden="true"
              className="
                absolute
                inset-x-10
                -bottom-8
                -z-10
                h-24
                rounded-full
                bg-black/[0.08]
                blur-[45px]
              "
            />
          </motion.div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Product illustration                                              */}
        {/* ---------------------------------------------------------------- */}
      </div>

      {/* Bottom spacing */}

      {/* <div className="h-14 sm:h-20 lg:h-28" /> */}
    </section>
  );
}

export function HeroHeading({
  noColorText,
  firstLine,
  lastLine,
}: {
  noColorText?: string;
  firstLine: string;
  lastLine: string;
}) {
  const reducedMotion = useReducedMotion() === true;

  return (
    <h1
      className="
                max-w-[940px]
                font-heading
                text-[36px]
                font-medium
                leading-[1.04]
                tracking-[-0.052em]
                text-[#11120e]
                sm:text-[50px]
                md:text-[58px]
                lg:text-[54px]
              "
    >
      {/* First line */}
      <BlurWord
        delay={0.05}
        duration={0.85}
        reducedMotion={reducedMotion}
        className="mr-3 sm:mr-4"
      >
        {noColorText}{" "}
      </BlurWord>
      {/* AI-powered highlighted text */}
      <span className="relative isolate inline-block whitespace-nowrap">
        <BlurWord
          delay={0.13}
          duration={0.9}
          reducedMotion={reducedMotion}
          className="relative z-10"
        >
          {firstLine}
        </BlurWord>

        {/* Animated highlight */}

        <motion.span
          aria-hidden="true"
          initial={
            reducedMotion
              ? false
              : {
                  scaleX: 0,
                  opacity: 0,
                }
          }
          animate={{
            scaleX: 1,
            opacity: 1,
          }}
          transition={{
            duration: reducedMotion ? 0 : 0.8,
            delay: reducedMotion ? 0 : 0.42,
            ease: EASE,
          }}
          className="
                    absolute
                    -inset-x-2
                    bottom-[2px]
                    top-[4px]
                    -z-10
                    origin-left
                    rounded-[5px]
                    bg-[#7fedfe5e]
                    sm:-inset-x-3
                  "
        />
      </span>{" "}
      <br />
      {/* Second line */}
      <BlurText
        text={lastLine}
        delay={0.2}
        stagger={0.075}
        duration={0.9}
        reducedMotion={reducedMotion}
      />
    </h1>
  );
}
