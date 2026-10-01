"use client";

import React from "react";
import { cn } from "@/lib/utils";

type FadeVariant = "bottom-left" | "bottom-right" | "center-arc" | "flat";

interface CardBottomFadeProps {
  height?: string;
  variant?: FadeVariant;
  className?: string;
  /** Background tone to dissolve into (defaults to card white #ffffff) */
  color?: string;
}

export function CardBottomFade({
  height = "h-28",
  variant = "bottom-left",
  className,
  color = "#ffffff",
}: CardBottomFadeProps) {
  // Compute radial focal point based on variant
  const getGradientCoordinates = () => {
    switch (variant) {
      case "bottom-left":
        return "circle at 0% 100%";
      case "bottom-right":
        return "circle at 100% 100%";
      case "center-arc":
        return "ellipse 90% 100% at 50% 100%";
      case "flat":
      default:
        return null;
    }
  };

  const coords = getGradientCoordinates();

  // Multi-stop progressive dissipation curve (scrim curve)
  const maskStyle: React.CSSProperties = coords
    ? {
        WebkitMaskImage: `radial-gradient(${coords}, black 20%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.2) 75%, transparent 100%)`,
        maskImage: `radial-gradient(${coords}, black 20%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.2) 75%, transparent 100%)`,
      }
    : {
        WebkitMaskImage: `linear-gradient(to top, black 25%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0.18) 80%, transparent 100%)`,
        maskImage: `linear-gradient(to top, black 25%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0.18) 80%, transparent 100%)`,
      };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 overflow-hidden select-none",
        height,
        className
      )}
    >
      {/* ── Layer 1: Hardware-accelerated Optical Backdrop Blur ── */}
      <div
        className="absolute inset-0 backdrop-blur-[12px] sm:backdrop-blur-[16px]"
        style={maskStyle}
      />

      {/* ── Layer 2: Soft Atmospheric Tint Dissolve ── */}
      <div
        className="absolute inset-0"
        style={{
          ...maskStyle,
          backgroundColor: color,
          opacity: 0.88,
        }}
      />

      {/* ── Layer 3: Grounding Base (Ensures absolute corner opacity) ── */}
      <div
        className="absolute inset-0"
        style={{
          background: coords
            ? `radial-gradient(${coords}, ${color} 15%, transparent 70%)`
            : `linear-gradient(to top, ${color} 10%, transparent 65%)`,
          opacity: 0.75,
        }}
      />
    </div>
  );
}