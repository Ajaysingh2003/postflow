"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import { motion } from "framer-motion";

type PlanType = "monthly" | "quarterly" | "annually";

type PricingTimelineType = {
  timeLine: PlanType;
  setTimeLine: React.Dispatch<React.SetStateAction<PlanType>>;
};

const plans: {
  label: string;
  scope: PlanType;
}[] = [
  {
    label: "Monthly",
    scope: "monthly",
  },
  {
    label: "Quarterly",
    scope: "quarterly",
  },
  {
    label: "Annually",
    scope: "annually",
  },
];


function PricingPlan({
  timeLine,
  setTimeLine,
}: PricingTimelineType) {
  return (
    <div
      style={{
        background: "#B9B9B913",
      }}
      className="flex gap-1 rounded-md p-1"
    >
      {plans.map((plan) => {
        const isActive = plan.scope === timeLine;

        return (
          <Button
            key={plan.scope}
            onClick={() => setTimeLine(plan.scope)}
            variant="outline"
            className={`
              relative
              cursor-pointer
              overflow-visible
              rounded-md
              border
              bg-transparent
              px-3
              py-1.5
              text-xs
              font-semibold
              shadow-none
              transition-colors
              duration-300

              ${
                isActive
                  ? `
                    border-transparent
                    text-accent
                    hover:bg-transparent
                    hover:text-accent
                  `
                  : `
                    border-transparent
                    text-stone-500
                    hover:border-zinc-200
                    hover:bg-white/10
                    hover:text-accent
                    hover:shadow-2xs
                  `
              }
            `}
          >
            {/* sliding active background */}
            {isActive && (
              <motion.span
                layoutId="pricing-active-plan"
                className="
                  absolute
                  inset-0
                  rounded-md
                  border
                  border-zinc-200/80
                  bg-white/90
                  shadow-2xs
                "
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 35,
                  mass: 0.7,
                }}
              />
            )}

            {/* label */}
            <motion.span
              className="relative z-10"
              animate={{
                y: isActive ? -1 : 0,
              }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
              }}
            >
              {plan.label}
            </motion.span>

            {/* save badge */}
            {plan.scope !== "monthly" && (
              <motion.span
                animate={
                  isActive
                    ? {
                        y: "50%",
                        scale: 1,
                      }
                    : {
                        y: "50%",
                        scale: 0.92,
                      }
                }
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 24,
                }}
                className="
                  absolute
                  bottom-0
                  left-1/2
                  z-20
                  -translate-x-1/2
                  whitespace-nowrap
                  rounded-3xl
                  bg-blue-500
                  px-2
                  py-0.5
                  text-center
                  text-[10px]
                  font-bold
                  uppercase
                  text-white
                  shadow-sm
                "
              >
                {plan.scope === "quarterly"
                  ? "Save 10%"
                  : "Save 20%"}
              </motion.span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

export default PricingPlan;