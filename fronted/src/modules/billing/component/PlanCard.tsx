import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeatureItem, PlanConfig } from "@/modules/types";
import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
function PlanCard({
  plan,
  timeLine,
  popular = false,
  feature,
}: {
  plan: PlanConfig;
  timeLine: "monthly" | "quarterly" | "annually";
  popular?: boolean;
  feature?: FeatureItem[];
}) {
  const [hoverSeeAll, sethoverSeeAll] = useState(false);

  return (
    <div
      className={cn(
        "rounded-xl border shadow-sm flex flex-col  border-zinc-200 p-1 overflow-hidden bg-whitee/50",
        popular && "bg-background-card-popular",
      )}
    >
      <PlanCardHeader popular={popular} timeLine={timeLine} plan={plan} />
      <div
        className={cn(
          "px-5 mt-4 pb-2 flex flex-col flex-1 justify-between",
          !popular && "",
        )}
      >
        <ul className="flex flex-col  gap-3">
          {feature?.map((e, i) => (
            <li key={i} className="flex items-center gap-3 font-medium ">
              <HugeiconsIcon
                icon={e.icon}
                size={14}
                className={cn("text-accent", popular && "text-white/80")}
                strokeWidth={1.5}
              />
              <span
                className={cn(
                  "text-accent text-[13px] tracking-wide",
                  popular && "text-white",
                )}
              >
                {e.label}
              </span>
            </li>
          ))}
        </ul>
        <Button
          // key={i}
          onMouseEnter={() => {
            sethoverSeeAll(true);
          }}
          onMouseLeave={() => sethoverSeeAll(false)}
          variant={"outline"}
          className={`rounded-xl text-xs md:text-[13px] mt-4 capitalizez md:text-md font-semibold  cursor-pointer border px-3 py-1.5  transition-all duration-200 ${
            !popular
              ? "bg-white/90 text-accent shadow-sm  hover:bg-white/60  hover:border-zinc-200 hover:text-accent"
              : "border-zinc-800 hover:bg-transparent bg-transparent  text-stone-300 duration-300 transition-all  hover:text-stone-300   hover:shadow-2xs"
          }
                         relative
                        `}
        >
          Explore all feature{" "}
          <span
            className={cn(
              "bg-gray-300 overflow-hidden rounded-full size-5 text-center flex items-center justify-center ",
              popular && "bg-stone-700",
            )}
          >
            <motion.div
              initial={{ x: 10 }}
              animate={{ x: hoverSeeAll ? [0, 20, 0] : 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className="w-full flex items-start justify-center gap-1"
            >
              <ArrowRight
                className={cn("size-4", popular && "text-stone-300")}
              />
            </motion.div>
          </span>
        </Button>
      </div>
    </div>
  );
}

export default PlanCard;

function PlanCardHeader({
  plan,
  timeLine,
  popular,
}: {
  plan: PlanConfig;
  timeLine: "monthly" | "quarterly" | "annually";
  popular: boolean;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const mutate = useMutation(
    trpc.billing.Createcheckout.mutationOptions({
      onSuccess(data) {
        if (data?.url) {
          window.location.assign(data.url);
        }
      },
      onError(error) {
        if (
          error.data?.code === "UNAUTHORIZED" ||
          error.message?.includes("Authentication required")
        ) {
          toast.error("Please sign in to choose a paid plan.");
          router.push(
            "/login?redirect=" + encodeURIComponent(window.location.pathname),
          );
          return;
        }
        toast.error(
          error.message || "Failed to initiate checkout. Please try again.",
        );
      },
    }),
  );
  return (
    <div
      className={cn(
        "w-full px-5 py-6 flex flex-col gap-2 bg-[#fbfbfbz] bg-white rounded-xl border border-zinc-200 shadow-2xs",
        popular && "bg-transparent border-zinc-800 ",
      )}
    >
      <h3
        className={cn(
          "text-lg md:text-xl text-accent  font-heading font-semibold",
          popular && "text-white",
        )}
      >
        {plan.name}
      </h3>
      <p
        className={cn(
          "text-gray-900 capitalize tracking-wider text-sm font-normal leading-relaxed",
          popular && "text-white/80",
        )}
      >
        {plan.description}
      </p>

      <p className="font-bold space-x-2 items-center md:text-3xl lg:text-4xl text-accent">
        {timeLine != "monthly" &&
          plan?.billing_cycles?.[timeLine]?.amount > 0 && (
            <span
              className={cn(
                "text-2xl text-stone-500 line-through",
                popular && "text-white/80",
              )}
            >
              ${plan?.billing_cycles?.["monthly"]?.amount}
            </span>
          )}
        <span className={cn(popular && "text-white")}>
          ${plan?.billing_cycles?.[timeLine]?.amount}
        </span>
      </p>

      <div className="">
        <Button
          disabled={mutate.isPending}
          onClick={() => {
            const priceId = plan.billing_cycles?.[timeLine]?.price_id;
            mutate.mutate({
              price_id: priceId,
              plan_code: plan.id,
            });
          }}
          variant={"outline"}
          className={`rounded-md   w-full capitalize font-semibold  cursor-pointer border px-3 py-1.5 md:py-2 text-xs md:text-sm transition-all duration-200 ${
            popular
              ? "bg-white/90 text-black secondary-btn  shadow-2xs  hover:bg-white/90  hover:border-zinc-200 hover:text-zinc-800"
              : "bg-white/90z primary-btn text-accent  shadow-2xs  hover:bg-white/60  hover:border-zinc-200 hover:text-accent"
          }
             relative
            `}
        >
          {mutate.isPending ? "Opening checkout…" : "Choose plan"}
        </Button>
      </div>
    </div>
  );
}
