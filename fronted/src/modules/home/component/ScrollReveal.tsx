"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useAnimate, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Enhance visible server HTML only when it approaches the viewport. */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  distance = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const inView = useInView(scope, {
    once: true,
    margin: "0px 0px 80px 0px",
    amount: "some",
  });
  const reducedMotion = useReducedMotion();
  const playback = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    const element = scope.current;
    // Keep content readable without JavaScript, before hydration, and when
    // reduced motion is requested. Only enhance on the first viewport entry.
    if (!element || !inView || reducedMotion !== false) return;
    if (element.contains(document.activeElement)) return;

    const animation = animate(
      element,
      {
        opacity: [0, 1],
        transform: [`translate3d(0, ${distance}px, 0) scale(0.985)`, "none"],
      },
      {
        duration: 0.7,
        delay: Math.min(0.18, Math.max(0, delay)),
        ease: [0.22, 1, 0.36, 1],
      },
    );
    playback.current = animation;
    return () => {
      // Finish before stopping so changing preferences or interrupting an
      // effect cannot leave content transparent or transformed.
      animation.complete();
      animation.stop();
      playback.current = null;
    };
  }, [animate, delay, distance, inView, reducedMotion, scope]);

  return (
    <div
      ref={scope}
      data-scroll-reveal=""
      className={cn("min-w-0", className)}
      onFocusCapture={() => playback.current?.complete()}
    >
      {children}
    </div>
  );
}
