"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { SettingsLink } from "@/modules/settings/SettingsProvider";
import { cn } from "@/lib/utils";
import PricingCardSection from "@/modules/billing/component/PricingCardSection";
import PricingSection from "@/modules/billing/component/PricingSection";

/**
 * Edit these to match your real plans. Keep each perk to something a free
 * user can actually feel, in plain words.
 */
const PREMIUM_PERKS = [
  "Connect more channels",
  "Schedule more posts each month",
  "More AI drafts in your own voice",
  "Full analytics history",
  "Early access to Agents",
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFC]/40";

export function UpgradeSubscription({ isPremium = false }: { isPremium?: boolean }) {
  const { open: sidebarOpen } = useSidebar();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Premium users never see the prompt.
  if (isPremium) return null;

  return (
    <>
      {sidebarOpen ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-[#7C5CFC]" />
            <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
              You&rsquo;re on the Free plan
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            Get more channels, posts, and AI drafts with Premium.
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "mt-3 flex h-8 w-full items-center justify-center rounded-lg bg-[#7C5CFC] text-[13px] font-medium text-white transition-colors hover:bg-[#6b4ae8]",
              FOCUS_RING,
            )}
          >
            Upgrade to Premium
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          aria-label="Upgrade to Premium"
          aria-haspopup="dialog"
          className={cn(
            "mx-auto flex size-9 items-center justify-center rounded-lg bg-[#7C5CFC]/10 text-[#7C5CFC] transition-colors hover:bg-[#7C5CFC]/20",
            FOCUS_RING,
          )}
        >
          <Sparkles className="size-4" />
        </button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[1120px]">
          <DialogHeader>
            <DialogTitle>Upgrade to Premium</DialogTitle>
            <DialogDescription>
              Give your ideas more room. Premium includes:
            </DialogDescription>
          </DialogHeader>

          {/* <ul className="space-y-3 py-1">
            {PREMIUM_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#7C5CFC]/12 text-[#7C5CFC]">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  {perk}
                </span>
              </li>
            ))}
          </ul> */}

<PricingSection />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Not now
            </Button>
            <SettingsLink
              section="billing"
              onClick={() => setDialogOpen(false)}
              className="primary-btn inline-flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-medium"
            >
              See plans
            </SettingsLink>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}