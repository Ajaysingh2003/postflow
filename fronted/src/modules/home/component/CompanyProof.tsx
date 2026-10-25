// TODO: Verify testimonial attribution, statistics and consent before replacing placeholder portraits.
"use client";

import React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";

type Platform = "x" | "linkedin" | "threads";

interface Creator {
  name: string;
  handle: string;
  metric: string;
  platform: Platform;
  image: string;
}

const creators: Creator[] = [
  {
    name: "Alex Rivera",
    handle: "@alexrivera",
    metric: "48K followers",
    platform: "x",
    image: "/images/placeholders/home-testimonial-portrait.png",
  },
  {
    name: "Marcus Vance",
    handle: "marcus-vance",
    metric: "Top Voice • 82K",
    platform: "linkedin",
    image: "/images/placeholders/home-testimonial-portrait.png",
  },
  {
    name: "Elena Rostova",
    handle: "@elena.threads",
    metric: "24K audience",
    platform: "threads",
    image: "/images/placeholders/home-testimonial-portrait.png",
  },
  {
    name: "David Kim",
    handle: "@davidkbuilds",
    metric: "110K readers",
    platform: "x",
    image: "/images/placeholders/home-testimonial-portrait.png",
  },
];

export default function CreatorProof() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mt-3 flex flex-col items-center justify-center space-y-6 pt-6"
    >
      {/* 1. Trust Bar: Avatars + Stars + Metric */}
      <div className="flex flex-wrap w-full items-center  gap-3">
        <div className="flex -space-x-2.5 overflow-hidden">
          {creators.map((c) => (
            <div
              key={c.handle}
              className="relative size-8 overflow-hidden rounded-full ring-2 ring-background"
            >
              <Image
                src={c.image}
                alt="Placeholder creator portrait"
                width={32}
                height={32}
                className="size-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="size-3.5 fill-current" />
            ))}
          </div>
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            5.0
          </span>
        </div>

        <span className="hidden text-zinc-300 dark:text-zinc-700 sm:inline">
          •
        </span>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Trusted by{" "}
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
            2,400+ creators
          </strong>{" "}
          publishing daily
        </p>
      </div>
    </motion.div>
  );
}
