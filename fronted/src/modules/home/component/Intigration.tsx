"use client";
// TODO(launch-content): Owner must verify existing endorsements, product and compliance claims; do not reuse them in structured data.

import Image from "next/image";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Data Definitions                                                           */
/* -------------------------------------------------------------------------- */

interface IntegrationItem {
  id: string;
  name: string;
  image: string;
  alt: string;
  type?: "full" | "badge";
  imgClass?: string;
  textColor?: string;
}

const STORAGE_INTEGRATIONS: IntegrationItem[] = [
  {
    id: "x",
    name: "X",
    image: "/channels/x.jpeg",
    alt: "X",
    type: "badge",
    textColor: "#000000", // Official X / Twitter Black
  },
  {
    id: "instagram",
    name: "Instagram",
    image: "/channels/instagram.svg",
    alt: "Instagram",
    type: "badge",
    textColor: "#E4405F", // Official Instagram Magenta-Red
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    image: "/channels/linkedin.svg",
    alt: "LinkedIn",
    type: "badge",
    textColor: "#0A66C2", // Official LinkedIn Blue
  },
  {
    id: "threads",
    name: "Threads",
    image: "/channels/threads.svg",
    alt: "Threads",
    type: "badge",
    textColor: "#101010", // Official Threads Black
  },
  {
    id: "reddit",
    name: "Reddit",
    image: "/channels/reddit.svg",
    alt: "Reddit",
    type: "badge",
    textColor: "#FF4500", // Official Reddit Orangey-Red
  },
  {
    id: "tiktok",
    name: "TikTok",
    image: "/channels/tiktok.svg",
    alt: "TikTok",
    type: "badge",
    textColor: "#FE2C55", // Official TikTok Brand Pink/Red (or "#000000")
  },
];
/* -------------------------------------------------------------------------- */
/* Geometric Cluster Layout Settings                                          */
/* -------------------------------------------------------------------------- */

const CARD_CONFIGS = [
  // Row 1 (4 items)
  {
    rotate: -8,
    className: "-mr-4 sm:-mr-6 z-10",
    width: "w-[96px] sm:w-28",
    baseZ: 10,
  },
  {
    rotate: 9,
    className: "-mt-2 -mr-3 sm:-mr-4 z-20",
    width: "w-[108px] sm:w-32",
    baseZ: 20,
  },
  {
    rotate: -11,
    className: "-mr-4 sm:-mr-6 z-10",
    width: "w-[96px] sm:w-28",
    baseZ: 10,
  },
  {
    rotate: 8,
    className: "z-10",
    width: "w-[96px] sm:w-28",
    baseZ: 10,
  },
  // Row 2 (3 items overlapping underneath)
  {
    rotate: 13,
    className: "mt-2 -mr-4 sm:-mr-6 z-20",
    width: "w-[96px] sm:w-28",
    baseZ: 20,
  },
  {
    rotate: -8,
    className: "-mt-6 sm:-mt-8 -mr-4 sm:-mr-6 z-30",
    width: "w-[96px] sm:w-28",
    baseZ: 30,
  },
  {
    rotate: -18,
    className: "-mt-3 sm:-mt-4 z-10",
    width: "w-[96px] sm:w-28",
    baseZ: 10,
  },
];

/* -------------------------------------------------------------------------- */
/* Interactive Card Component with Framer Motion                              */
/* -------------------------------------------------------------------------- */

function IntegrationCard({
  item,
  config,
  index,
}: {
  item: IntegrationItem;
  config: (typeof CARD_CONFIGS)[0];
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={cn("relative select-none", config.className)}
      initial={{ opacity: 0, scale: 0.85, y: 15 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      animate={{
        opacity: 1,
        scale: 1,
        y: isHovered ? 0 : [0, -3, 0],
      }}
      transition={{
        delay: index * 0.05,
        type: "spring",
        stiffness: 320,
        damping: 22,
        y: {
          repeat: Infinity,
          repeatType: "mirror",
          duration: 2.8 + (index % 3) * 0.5,
          ease: "easeInOut",
          delay: index * 0.2,
        },
      }}
      style={{
        zIndex: isHovered ? 60 : config.baseZ,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className={cn(
          "group relative flex items-center justify-center h-12 bg-white rounded-xl",
          "border border-stone-200/80 cursor-pointer !px-2.5",
          "shadow-[0_4px_16px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)]",
          config.width,
        )}
        animate={{
          rotate: isHovered ? 0 : config.rotate,
          y: isHovered ? -22 : 0,
          scale: isHovered ? 1.08 : 1,
          boxShadow: isHovered
            ? "0 22px 35px -8px rgba(0, 0, 0, 0.12), 0 8px 14px -4px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.08)"
            : "0 4px 16px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)",
          borderColor: isHovered
            ? "rgba(0, 0, 0, 0.16)"
            : "rgba(229, 231, 235, 0.8)",
        }}
        whileTap={{ scale: 0.95 }}
        transition={{
          type: "spring",
          stiffness: 420,
          damping: 24,
          mass: 0.8,
        }}
      >
        {/* Subtle top reflection highlight */}
        <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/70 to-transparent pointer-events-none" />

        {item.type === "badge" ? (
          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
            <Image
              src={item.image}
              width={22}
              height={22}
              alt={item.alt}
              className="h-5 w-5 sm:h-5.5 sm:w-5.5 object-contain shrink-0"
              loading="lazy"
            />
            <span
              className="font-medium text-xs sm:text-[13px] tracking-tight  capitalize truncate max-w-[62px] sm:max-w-[70px]"
              style={{ color: item.textColor || "#1f2937" }}
            >
              {item.name}
            </span>
          </div>
        ) : (
          <Image
            src={item.image}
            width={110}
            height={24}
            alt={item.alt}
            className={item.imgClass || "h-6 w-auto object-contain"}
            loading="lazy"
          />
        )}
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

interface IntigrationProps {
  className?: string;
  showTestimonial?: boolean;
}

export default function Intigration({
  className,
  showTestimonial = true,
}: IntigrationProps) {
  return (
    <section
      id="integrations"
      className={cn(
        "w-full py-6 sm:py-8 md:py-12 relative overflow-visible",
        className,
      )}
    >
      {/* Heading & Subheading */}
      <div className="relative flex flex-col items-center justify-center text-center gap-2 sm:gap-3 max-w-2xl mx-auto px-4">
        <h2 className="font-heading text-3xl sm:text-4xl lg:text-[42px] font-semibold tracking-tight text-neutral-900 leading-tight">
          Your content. Every platform.
        </h2>
        <p className="text-base sm:text-lg text-[#6B7280] font-normal leading-relaxed">
          Create once, tailor for each platform, and share your ideas wherever
          your audience is.{" "}
          <a
            href="/product/social-integration"
            className="inline-flex items-center text-neutral-900 hover:text-neutral-600 underline underline-offset-4 font-medium transition-colors"
          >
            docs
            <ArrowUpRight className="h-4 w-4 ml-0.5 inline-block" />
          </a>
        </p>
      </div>

      {/* Clustered Cards Area */}
      <div className="mt-8 sm:mt-12 w-full flex justify-center">
        <div className="max-w-[460px] flex flex-wrap justify-center gap-x-1 gap-y-2 sm:gap-4 items-center">
          {STORAGE_INTEGRATIONS.map((item, index) => (
            <IntegrationCard
              key={item.id}
              item={item}
              config={CARD_CONFIGS[index % CARD_CONFIGS.length]}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Testimonial / Social Proof */}
      {showTestimonial && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-10 sm:mt-12 flex flex-col items-center text-center px-4"
        >
          <div className="text-sm sm:text-base text-neutral-600 font-normal">
            “
            <span className="bg-[#dbeafe] text-neutral-900 rounded-[4px] px-1.5 py-0.5 font-medium">
              I&apos;m a huge fan of Rowley!
            </span>{" "}
            Team did a great job.”{" "}
            <span className="text-stone-300 mx-1">—</span>{" "}
            <a
              href="https://www.producthunt.com"
              target="_blank"
              rel="noreferrer"
              className="text-stone-400 hover:text-neutral-700 transition-colors"
            >
              producthunt.com
            </a>
          </div>

          <div className="mt-3.5 flex items-center gap-2.5">
            <div className="relative">
              <Image
                src="/images/placeholders/home-testimonial-portrait.png"
                width={40}
                height={40}
                alt="Placeholder testimonial portrait"
                className="h-10 w-10 rounded-full border border-stone-200/80 shadow-xs object-cover"
                loading="lazy"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-neutral-900 leading-tight">
                Steven Tey
              </span>
              <span className="text-xs text-stone-400 leading-tight mt-0.5">
                Founder, Dub.co
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
