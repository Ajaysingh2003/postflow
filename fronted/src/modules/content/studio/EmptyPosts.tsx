"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { FilePenLine, Plus } from "lucide-react";

const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const THREADS_PATH =
  "M16.5 9.5c-.6-2.2-2.3-3.5-4.7-3.5C8.6 6 6.5 8.5 6.5 12s2.1 6 5.3 6c2.6 0 4.2-1.4 4.2-3.2 0-2-1.8-3-4-3-1.5 0-2.4.7-2.4 1.6 0 .8.7 1.4 1.8 1.4 1.9 0 3.1-1.5 3.1-4";

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
        <svg viewBox="0 0 24 24" className="size-4" fill="#0A66C2">
          <path d={LINKEDIN_PATH} />
        </svg>
      </motion.span>

      <motion.span className={`${TILE} right-0 top-5`} {...float(1.1)}>
        <svg viewBox="0 0 24 24" className="size-3.5" fill="#111418">
          <path d={X_PATH} />
        </svg>
      </motion.span>

      <motion.span className={`${TILE} bottom-0 left-7`} {...float(1.8)}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none">
          <path
            d={THREADS_PATH}
            stroke="#111418"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
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