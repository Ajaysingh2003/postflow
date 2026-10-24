"use client";

import { Button } from "@/components/ui/button";
import React, { useId } from "react";
import { motion } from "framer-motion";

type PlanType = "monthly" | "quarterly" | "annually";

type PricingTimelineType = {
  timeLine: PlanType;
  setTimeLine: React.Dispatch<React.SetStateAction<PlanType>>;
  labels?: Partial<Record<PlanType, string>>;
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

function PricingPlan({ timeLine, setTimeLine, labels }: PricingTimelineType) {
  const activeId = useId();
  return (
    <div
      role="group"
      aria-label="Billing frequency"
      style={{
        background: "#B9B9B913",
      }}
      className="flex max-w-full flex-wrap justify-center gap-1 rounded-md p-1"
    >
      {plans.map((plan) => {
        const isActive = plan.scope === timeLine;

        return (
          <Button
            key={plan.scope}
            type="button"
            aria-pressed={isActive}
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
                layoutId={activeId}
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
              {labels?.[plan.scope] ?? plan.label}
            </motion.span>
          </Button>
        );
      })}
    </div>
  );
}

export default PricingPlan;
