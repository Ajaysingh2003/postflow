"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";
import { Globe2 } from "lucide-react";

import {
  BentoCard,
  CardBottomFade,
} from "./FeatureSection";

const CDN_NODES = [
  {
    id: "london",
    location: [51.5074, -0.1278] as [number, number],
  },
  {
    id: "new-york",
    location: [40.7128, -74.006] as [number, number],
  },
  {
    id: "frankfurt",
    location: [50.1109, 8.6821] as [number, number],
  },
  {
    id: "mumbai",
    location: [19.076, 72.8777] as [number, number],
  },
  {
    id: "singapore",
    location: [1.3521, 103.8198] as [number, number],
  },
  {
    id: "tokyo",
    location: [35.6762, 139.6503] as [number, number],
  },
  {
    id: "sydney",
    location: [-33.8688, 151.2093] as [number, number],
  },
];

const CDN_ARCS = [
  {
    from: CDN_NODES[0].location,
    to: CDN_NODES[1].location,
  },
  {
    from: CDN_NODES[0].location,
    to: CDN_NODES[2].location,
  },
  {
    from: CDN_NODES[2].location,
    to: CDN_NODES[3].location,
  },
  {
    from: CDN_NODES[3].location,
    to: CDN_NODES[4].location,
  },
  {
    from: CDN_NODES[4].location,
    to: CDN_NODES[5].location,
  },
  {
    from: CDN_NODES[4].location,
    to: CDN_NODES[6].location,
  },
];

export function FeatureCardTwo() {
  return (
    <BentoCard className="relative flex min-h-[420px] flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="relative z-20 p-6 pb-0 sm:p-7 sm:pb-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex size-8 items-center justify-center rounded-lg shadow-2xs bg-neutral-100 text-neutral-700">
            <Globe2 className="size-4" />
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50/90 px-2.5 py-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative size-1.5 rounded-full bg-priamry" />
            </span>

            <span className="font-subheading text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              global edge network
            </span>
          </div>
        </div>

        <div className="mt-5">
          <h2 className="font-heading text-lg sm:text-2xl font-semibold tracking-tight capitalize text-foreground flex items-center gap-2">
            Video delivered around the world
          </h2>

          <p className="mt-1 text-sm sm:text-base text-neutral-500 leading-relaxed max-w-[320px]">
            Cache and deliver every stream from the edge
            closest to your viewers.
          </p>
        </div>
      </div>

      {/* Globe section */}
      <div className="relative mt-auto h-[255px] overflow-hidden sm:h-[280px]">
        <LiveCDNGlobe />

        <CardBottomFade height="h-16" />
      </div>
    </BentoCard>
  );
}

function LiveCDNGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeWrapperRef = useRef<HTMLDivElement>(null);

  const pointerDownRef = useRef<number | null>(null);

  // Permanent accumulated drag rotation
  const rotationRef = useRef(0);

  // Current drag delta
  const dragRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = globeWrapperRef.current;

    if (!canvas || !wrapper) return;

    let animationFrame = 0;
    let destroyed = false;

    const size = wrapper.offsetWidth;

    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2,
    );

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,

      width: size,
      height: size,

      phi: 0.65,
      theta: 0.2,

      dark: 0,
      diffuse: 1.4,
      mapSamples: 24000,
      mapBrightness: 10,
      mapBaseBrightness: 0,

      baseColor: [1, 1, 1],
      markerColor: [0.16, 0.58, 0.92],
      glowColor: [0.96, 0.95, 0.93],

      markerElevation: 0.025,

      markers: CDN_NODES.map((node) => ({
        id: node.id,
        location: node.location,
        size: 0.025,
      })),

      arcs: CDN_ARCS,

      arcColor: [0.28, 0.63, 0.92],
      arcWidth: 0.35,
      arcHeight: 0.18,

      scale: 1,
      opacity: 1,
    });

    const animate = () => {
      if (destroyed) return;

      if (pointerDownRef.current === null) {
        rotationRef.current += 0.0015;
      }

      globe.update({
        phi:
          0.65 +
          rotationRef.current +
          dragRef.current,

        theta: 0.2,
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    canvas.style.opacity = "1";

    return () => {
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      globe.destroy();
    };
  }, []);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    pointerDownRef.current = event.clientX;
    dragRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (pointerDownRef.current === null) return;
    const delta = event.clientX - pointerDownRef.current;
    dragRef.current = delta / 160;
  };

  const finishDrag = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (pointerDownRef.current === null) return;

    rotationRef.current += dragRef.current;
    dragRef.current = 0;
    pointerDownRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }
  };

  return (
    <div className="absolute inset-0">
      {/* soft lighting behind globe */}
      <div
        aria-hidden
        className="
          pointer-events-none
          absolute
          bottom-[-180px]
          right-[-110px]
          size-[500px]
          rounded-full
          bg-transparent
          blur-[30px]

          sm:bottom-[-185px]
          sm:right-[-80px]
          sm:size-[540px]
        "
      />

      {/* Globe wrapper */}
      <div
        ref={globeWrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className="
          absolute
          bottom-[-210px]
          right-[-145px]

          size-[500px]

          cursor-grab
          touch-none
          select-none

          active:cursor-grabbing

          sm:bottom-[-220px]
          sm:right-[-95px]
          sm:size-[550px]
        "
      >
        <canvas
          ref={canvasRef}
          className="
            block
            size-full
            opacity-0
            transition-opacity
            duration-700
          "
        />
      </div>

      {/* foreground status */}
      <div
        className="
          pointer-events-none
          absolute
          bottom-5
          left-6
          z-20
          hidden
          items-center
          gap-2
          rounded-lg
          border
          border-black/[0.06]
          bg-white/90
          px-2.5
          py-2
          shadow-[0_8px_25px_-12px_rgba(0,0,0,0.16)]
          backdrop-blur-md
          sm:flex
        "
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-30" />
          <span className="relative size-2 rounded-full bg-primary" />
        </span>

        <div>
          <p className="font-heading text-xs font-semibold leading-none text-neutral-700">
            Nearest edge selected
          </p>

          <p className="font-subheading mt-1 text-[10px] text-neutral-400">
            automatic routing
          </p>
        </div>
      </div>
    </div>
  );
}