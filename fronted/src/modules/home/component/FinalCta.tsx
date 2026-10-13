"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";

const TRIAL_POINTS = ["3-day free trial", "No credit card", "Cancel anytime"];

export default function FinalCta() {
  const reduce = useReducedMotion();

  return (
    <section
      id="contact"
      className="relative w-full overflow-hidden py-6 sm:py-14 lg:py-20"
    >
      <div className="mx-auto w-full">
        {/* ================================================================ */}
        {/* CTA Card (background unchanged)                                  */}
        {/* ================================================================ */}
        <div
          className="
            relative isolate flex flex-col overflow-hidden
            rounded-[24px] border-[0.5px] border-[#172000]/15
            bg-[#3fda8a]z
            bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,#b9fad8_0%,#3fda8a_60%,#1db868_100%)]
            shadow-[0_1px_2px_rgba(23,32,0,0.06),0_28px_48px_-28px_rgba(23,32,0,0.3)]
            sm:rounded-[34px] lg:rounded-[36px]
          "
        >
          {/* Background light */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background: `
                radial-gradient(
                  70% 52% at 50% 0%,
                  rgba(255,255,255,0.70),
                  rgba(255,255,255,0) 72%
                ),
                linear-gradient(
                  to top,
                  rgba(88,116,0,0.18),
                  rgba(88,116,0,0) 32%
                )
              `,
            }}
          />

          {/* Subtle grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] opacity-[0.035]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(23,32,0,0.75) 1px, transparent 1px),
                linear-gradient(90deg, rgba(23,32,0,0.75) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 55%, black 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 55%, black 100%)",
            }}
          />

          {/* ============================================================ */}
          {/* Copy                                                         */}
          {/* ============================================================ */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-10 mx-auto flex max-w-[760px] flex-col items-center px-5 pt-10 text-center sm:px-6 sm:pt-16 lg:pt-24"
          >
            <h2 className="max-w-[300px] text-balance font-heading text-[34px] font-semibold leading-[1] tracking-[-0.045em] text-white drop-shadow-[0_2px_12px_rgba(6,56,29,0.28)] sm:max-w-[640px] sm:text-[54px] lg:text-[64px]">
              Write once. Show up everywhere.
            </h2>

            <p className="mt-4 max-w-[420px] text-[15px] leading-[1.5] text-white drop-shadow-[0_1px_8px_rgba(6,56,29,0.25)] sm:mt-5 sm:max-w-[540px] sm:text-lg sm:leading-7">
              Let Draftva handle the hard part. Write once, schedule across
              every channel, and start posting consistently today.
            </p>

            {/* Buttons */}
            <div className="mt-6 grid grid-cols-[200px_1fr] md:grid-cols-[250px_1fr]  w-full  items-stretch justify-center gap-2.5 sm:mt-8 sm:w-auto sm:flex-row sm:gap-3">
              <Link
                href="/register"
                className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 font-heading text-sm font-semibold text-[#0f7a47] shadow-[0_8px_20px_-8px_rgba(6,56,29,0.5)] transition-all hover:bg-white/95 active:scale-[0.98] sm:h-12 sm:w-auto sm:px-7 sm:text-base"
              >
                Start your free trial
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>

              <Link
                href="/#pricing"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/40 bg-white/20 px-6 font-heading text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/30 active:scale-[0.98] sm:h-12 sm:w-auto sm:px-7 sm:text-base"
              >
                See pricing
              </Link>
            </div>

            {/* Trial points */}
            <ul className="mt-4 flex max-w-[310px] flex-wrap justify-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-white sm:mt-5 sm:max-w-none sm:gap-x-4 sm:text-xs">
              {TRIAL_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Check
                    className="size-3 shrink-0 sm:size-3.5"
                    aria-hidden="true"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* ============================================================ */}
          {/* Banner image (your footer_baner.png)                         */}
          {/* ============================================================ */}
          <motion.div
            aria-hidden="true"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.85, delay: 0.15, ease: "easeOut" }}
            className="pointer-events-none relative z-0 mt-1 flex max-h-[220px] justify-center overflow-hidden -mb-[17%] sm:mt-3 sm:max-h-none sm:-mb-[7%]"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 18%, #000 90%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 18%, #000 90%, transparent 100%)",
            }}
          >
            <div className="relative h-full z-10 zh-[220px]. w-full sbm:h-[300px]">
              <Image
                src="/footer_banner_2.png"
                alt="banner"
                height={400}
                width={1280}
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
