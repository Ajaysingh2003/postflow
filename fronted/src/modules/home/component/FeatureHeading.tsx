"use client";

import React from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";

const BRAND = "#3fda8a";

const ease = [0.22, 1, 0.36, 1] as const;

/* ----------------------------------------
   Animation Variants
----------------------------------------- */

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.12,
    },
  },
};

const lineVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
    filter: "blur(12px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.85,
      ease,
    },
  },
};

const chipVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: "blur(8px)",
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    scale: 1,
    transition: {
      duration: 0.65,
      ease,
      delay: 0.12,
    },
  },
};

/* ----------------------------------------
   Animated Highlight Chip
----------------------------------------- */

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  reducedMotion: boolean;
}

function Chip({
  active,
  onClick,
  children,
  reducedMotion,
}: ChipProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      variants={reducedMotion ? undefined : chipVariants}
      className="relative mx-1 mt-2 inline-block cursor-pointer whitespace-nowrap rounded-xl px-3 py-1 align-baseline font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#3fda8a87] focus-visible:ring-offset-2"
    >
      {/* Default background */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-xl bg-zinc-100"
      />

      {/* Active moving background */}
      <AnimatePresence initial={false}>
        {active && (
          <motion.span
            layoutId="draftva-active-highlight"
            aria-hidden="true"
            className="absolute inset-0 rounded-xl"
            initial={false}
            transition={
              reducedMotion
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 280,
                    damping: 30,
                    mass: 0.8,
                  }
            }
            style={{
              backgroundColor: `${BRAND}22`,
              boxShadow: `
                inset 0 0 0 1px ${BRAND}75,
                0 2px 12px -6px ${BRAND}45
              `,
            }}
          />
        )}
      </AnimatePresence>

      <motion.span
  className="relative z-10 inline-block"
  initial={false}
  animate={{
    color: active ? "#3fda8a" : "#a1a1aa",
  }}
  transition={{
    duration: reducedMotion ? 0 : 0.35,
    ease,
  }}
>
  {children}
</motion.span>
    </motion.button>
  );
}

/* ----------------------------------------
   Draftva Headline
----------------------------------------- */

interface DraftvaHeadlineProps {
  activeStep: number;
  onStepChange: (step: number) => void;
}

export function DraftvaHeadline({
  activeStep,
  onStepChange,
}: DraftvaHeadlineProps) {
  const reducedMotion = !!useReducedMotion();

  const animations = reducedMotion
    ? undefined
    : containerVariants;

  const lineAnimation = reducedMotion
    ? undefined
    : lineVariants;

  return (
    <LayoutGroup id="draftva-headline">
      <motion.h2
        initial={reducedMotion ? false : "hidden"}
        whileInView={reducedMotion ? undefined : "visible"}
        viewport={{
          once: true,
          amount: 0.35,
        }}
        variants={animations}
        className="
          text-[22px]
          font-semibold
          leading-[1.35]
          tracking-tight
          text-zinc-400
          sm:text-3xl
          md:text-[34px]
          lg:text-[36px]
        "
      >
        {/* Line 1 */}
<motion.span variants={lineAnimation} className="block">
  <motion.span
    animate={{
      color: activeStep === 0 ? "#18181b" : "#a1a1aa",
    }}
    transition={{ duration: 0.45, ease }}
  >
    Craft every{" "}
    <Chip
      active={activeStep === 0}
      onClick={() => onStepChange(0)}
      reducedMotion={reducedMotion}
    >
      post
    </Chip>{" "}
    with AI,
  </motion.span>
</motion.span>

{/* Line 2 */}
<motion.span variants={lineAnimation} className="block">
  <motion.span
    animate={{
      color: activeStep === 1 ? "#18181b" : "#a1a1aa",
    }}
    transition={{ duration: 0.45, ease }}
  >
    <Chip
      active={activeStep === 1}
      onClick={() => onStepChange(1)}
      reducedMotion={reducedMotion}
    >
      publish
    </Chip>{" "}
    across every platform
  </motion.span>
</motion.span>

{/* Line 3 */}
<motion.span variants={lineAnimation} className="block">
  <motion.span
    animate={{
      color: activeStep === 2 ? "#18181b" : "#a1a1aa",
    }}
    transition={{ duration: 0.45, ease }}
  >
    and{" "}
    <Chip
      active={activeStep === 2}
      onClick={() => onStepChange(2)}
      reducedMotion={reducedMotion}
    >
      collaborate
    </Chip>{" "}
    with your team.
  </motion.span>
</motion.span>

      </motion.h2>
    </LayoutGroup>
  );
}