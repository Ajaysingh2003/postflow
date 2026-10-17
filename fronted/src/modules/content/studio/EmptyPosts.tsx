"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FilePenLine, Plus } from "lucide-react";
import { PlatformBadge } from "@/modules/home/component/PlatformBadge";

const TILE =
  "absolute flex size-8 items-center justify-center rounded-[10px] border border-border/80 bg-background shadow-[0_6px_16px_-8px_rgba(15,23,42,0.28)]";

function Lines({ widths }: { widths: number[] }) {
  return (
    <div className="space-y-1.5">
      {widths.map((w) => (
        <span
          key={w}
          className="block h-1 rounded-full bg-foreground/[0.08]"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

function Illustration() {
  const reduced = useReducedMotion();

  const float = (delay: number, distance = 4) =>
    reduced
      ? undefined
      : {
          animate: { y: [0, -distance, 0] },
          transition: {
            duration: 4.2,
            delay,
            repeat: Infinity,
            ease: "easeInOut" as const,
          },
        };

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mb-7 h-[124px] w-[272px] sm:w-[300px]"
    >
      {/* rings, faded toward the edges */}
      <div
        className="absolute inset-0"
        style={{
          maskImage: "radial-gradient(closest-side, #000 55%, transparent)",
          WebkitMaskImage: "radial-gradient(closest-side, #000 55%, transparent)",
        }}
      >
        {[150, 230, 310].map((size) => (
          <span
            key={size}
            className="absolute left-1/2 top-1/2 rounded-full border border-foreground/[0.07]"
            style={{
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
            }}
          />
        ))}
      </div>

      {/* back cards */}
      <div className="absolute left-[calc(50%-58px)] top-1/2 h-[88px] w-[116px] -translate-x-1/2 -translate-y-1/2 -rotate-[9deg] rounded-xl border border-border/80 bg-background p-3 shadow-sm">
        <Lines widths={[100, 70, 85]} />
      </div>
      <div className="absolute left-[calc(50%+58px)] top-1/2 h-[88px] w-[116px] -translate-x-1/2 -translate-y-1/2 rotate-[9deg] rounded-xl border border-border/80 bg-background p-3 shadow-sm">
        <Lines widths={[85, 100, 60]} />
      </div>

      {/* front card */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 -ml-[66px] -mt-[50px] h-[100px] w-[132px]"
        {...float(0, 3)}
      >
        <div className="size-full rounded-xl border border-border/80 bg-background p-3 shadow-[0_14px_30px_-14px_rgba(15,23,42,0.4)]">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-foreground/[0.06]">
              <FilePenLine
                className="size-3.5 text-foreground/75"
                strokeWidth={1.6}
              />
            </span>
            <span className="h-1.5 w-12 rounded-full bg-foreground/15" />
          </div>
          <Lines widths={[100, 78, 56]} />
        </div>

        {/* plus badge */}
        <span className="absolute -bottom-2 -right-2 flex size-6 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
          <Plus className="size-3.5 text-foreground/70" strokeWidth={1.8} />
        </span>
      </motion.div>

      {/* platforms, floating around the stack */}
      <motion.span className={`${TILE} left-1 top-1`} {...float(0.4)}>
        <PlatformBadge platform="linkedin" className="size-4.5 border-0 shadow-none" />
      </motion.span>

      <motion.span className={`${TILE} right-0 top-5`} {...float(1.1)}>
        <PlatformBadge platform="x" className="size-4 border-0 shadow-none" />
      </motion.span>

      <motion.span className={`${TILE} bottom-0 left-7`} {...float(1.8)}>
        <PlatformBadge platform="threads" className="size-4.5 border-0 shadow-none" />
      </motion.span>
    </div>
  );
}

export function EmptyPosts() {
  const reduced = useReducedMotion();

  return (
    <div className="flex lg:min-h-[calc(100vh_-_80px)]  w-full flex-col items-center justify-center px-6 py-12 text-center">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-[420px] flex-col items-center"
      >
        <Illustration />

        <span className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          Your writing space
        </span>

        <h1 className="font-serif text-[30px] leading-[1.15] tracking-[-0.045em] text-foreground sm:text-[34px]">
          Your next post starts here.
        </h1>

        <p className="mt-3 max-w-[340px] text-[13px] leading-[1.8] text-muted-foreground">
          Connect a social account to start writing, refining, and scheduling
          your content in one place.
        </p>

        <Link
          href="/dashboard/channels"
          className="primary-btn mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[12px] font-medium transition-all duration-200 active:scale-[0.98]"
        >
          <Plus size={15} strokeWidth={1.8} />
          Connect an account
        </Link>

        <p className="mt-4 text-[11px] text-muted-foreground/70">
          Works with LinkedIn, X and Threads
        </p>
      </motion.div>
    </div>
  );
}