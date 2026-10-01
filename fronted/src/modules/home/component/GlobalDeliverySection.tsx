"use client";

import React, { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { Activity, ArrowUpRight, ShieldCheck, Zap } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface NodeLocation {
  id: string;
  city: string;
  country: string;
  latency: string;
  location: [number, number];
}

const CDN_NODES: NodeLocation[] = [
  {
    id: "london",
    city: "London",
    country: "UK",
    latency: "14ms",
    location: [51.5074, -0.1278],
  },
  {
    id: "new-york",
    city: "New York",
    country: "US",
    latency: "24ms",
    location: [40.7128, -74.006],
  },
  {
    id: "frankfurt",
    city: "Frankfurt",
    country: "DE",
    latency: "18ms",
    location: [50.1109, 8.6821],
  },
  {
    id: "mumbai",
    city: "Mumbai",
    country: "IN",
    latency: "22ms",
    location: [19.076, 72.8777],
  },
  {
    id: "singapore",
    city: "Singapore",
    country: "SG",
    latency: "27ms",
    location: [1.3521, 103.8198],
  },
  {
    id: "tokyo",
    city: "Tokyo",
    country: "JP",
    latency: "31ms",
    location: [35.6762, 139.6503],
  },
  {
    id: "sydney",
    city: "Sydney",
    country: "AU",
    latency: "38ms",
    location: [-33.8688, 151.2093],
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

const HIGHLIGHTS = [
  {
    key: "local",
    text: "Feel local.",
  },
  {
    key: "instant",
    text: "Start instantly.",
  },
  {
    key: "smooth",
    text: "Stay smooth.",
  },
];

const METRICS = [
  {
    value: "99.99%",
    label: "Uptime",
    description: "Global availability",
  },
  {
    value: "24ms",
    label: "Latency",
    description: "Median edge response",
  },
  {
    value: "7",
    label: "Regions",
    description: "And growing",
  },
];

export default function GlobalDeliverySection() {
  const [activeNode, setActiveNode] = useState("frankfurt");
  const [activeStep, setActiveStep] = useState(0);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const interval = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % HIGHLIGHTS.length);
    }, 2600);

    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  const muted =
    "text-[#a5a79f] transition-colors duration-300 hover:text-[#5d6057]";

  const active = "text-[#171914] font-semibold";

  return (
    <section className="relative w-full overflow-hidden bg-transparent">
      {/* subtle page texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,.16) .6px, transparent .6px)",
          backgroundSize: "24px 24px",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 72%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 72%, transparent 100%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="max-w-3xl pt-20 text-left sm:pt-24 lg:pt-28">
          <div className="mb-3 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-[#B3E61D]" />

            <span className="font-subheading text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8c8f86]">
              Global Video delivery
            </span>
          </div>

          <h2 className="font-heading text-[22px] font-medium leading-[1.35] tracking-[-0.02em] sm:text-[26px] md:text-[27px] lg:text-[36px]">
            {/* Step 1 */}
            <span className={activeStep === 0 ? active : muted}>
              Stream everywhere,{" "}
            </span>

            {/* Animated highlighted text */}
            <span className="relative inline-block">
              <motion.span
                key={HIGHLIGHTS[activeStep].key}
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 4,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.25,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative z-10 px-1 font-semibold text-[#171914]"
              >
                {HIGHLIGHTS[activeStep].text}
              </motion.span>

              {/* highlight */}
              <motion.span
                key={`highlight-${activeStep}`}
                initial={
                  reducedMotion
                    ? false
                    : {
                        scaleX: 0,
                      }
                }
                animate={{
                  scaleX: 1,
                }}
                transition={{
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="
        absolute
        inset-x-0
        bottom-[2px]
        h-[7px]
        origin-left
        rounded-[3px]
        bg-[#B3E61D]/80
      "
              />
            </span>

            {/* Step 2 */}
            <span className={activeStep === 1 ? active : muted}>
              {" "}
              from the nearest edge{" "}
            </span>

            {/* Step 3 */}
            <span className={activeStep === 2 ? active : muted}>
              for fast, smooth playback.
            </span>
          </h2>

          <p
            className="
              mt-6
              max-w-xl
              text-[15px]
              leading-7
              text-neutral-500

              sm:text-[17px]
              sm:leading-8
            "
          >
            Upload once and let the network handle the distance. Every viewer
            connects to the closest healthy edge for fast starts, smooth
            playback and consistently low latency.
          </p>
        </div>

        {/* =====================================================
            GLOBE
        ====================================================== */}

        <div
          className="
            relative
            mt-1
            h-[390px]
            w-full
            overflow-hidden

            sm:mt-4
            sm:h-[590px]

            lg:h-[670px]
          "
        >
          {/* central glow */}
          <div
            aria-hidden
            className="
              pointer-events-none
              absolute
              left-1/2
              top-[63%]
              size-[280px]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              bg-[#d1ff46]/10
              blur-[90px]

              sm:top-[55%]
              sm:size-[540px]
              sm:blur-[140px]
            "
          />

          <LiveCDNGlobe activeNode={activeNode} setActiveNode={setActiveNode} />

          {/* important: soft fade into section background */}
          <div
            aria-hidden
            className="
    pointer-events-none
    absolute
    inset-x-0
    bottom-0
    z-30
    h-[135px]

    bg-gradient-to-t
    from-[#faf9f5]
    via-[#faf9f5]/95
    to-transparent

    sm:h-[150px]
  "
          />
        </div>

        {/* =====================================================
            METRICS
        ====================================================== */}

        <MetricsSection />
      </div>
    </section>
  );
}

/* ============================================================
   GLOBE
============================================================ */

function LiveCDNGlobe({
  activeNode,
  setActiveNode,
}: {
  activeNode: string;
  setActiveNode: React.Dispatch<React.SetStateAction<string>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const globeRef = useRef<ReturnType<typeof createGlobe> | null>(null);

  const pointerDownRef = useRef<number | null>(null);
  const pointerPreviousXRef = useRef(0);

  const rotationRef = useRef(0);
  const velocityRef = useRef(0);

  const sizeRef = useRef(500);
  const activeRef = useRef(activeNode);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    activeRef.current = activeNode;

    globeRef.current?.update({
      markers: CDN_NODES.map((node) => ({
        id: node.id,
        location: node.location,
        size: node.id === activeNode ? 0.055 : 0.034,
        color:
          node.id === activeNode
            ? ([0.82, 1, 0.27] as [number, number, number])
            : ([0.32, 0.33, 0.3] as [number, number, number]),
      })),
    });
  }, [activeNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const updateSize = () => {
      sizeRef.current = wrapper.offsetWidth;
      return sizeRef.current;
    };

    const initialSize = updateSize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,

      width: initialSize * dpr,
      height: initialSize * dpr,

      phi: 0.7,
      theta: 0.16,

      dark: 0,

      diffuse: 1.2,

      mapSamples: 32000,
      mapBrightness: 5.8,
      mapBaseBrightness: 0,

      baseColor: [0.96, 0.965, 0.95],

      markerColor: [0.82, 1, 0.27],

      glowColor: [0.98, 0.99, 0.97],

      markerElevation: 0.035,

      markers: CDN_NODES.map((node) => ({
        id: node.id,
        location: node.location,
        size: node.id === activeRef.current ? 0.055 : 0.034,

        color:
          node.id === activeRef.current
            ? ([0.82, 1, 0.27] as [number, number, number])
            : ([0.32, 0.33, 0.3] as [number, number, number]),
      })),

      arcs: CDN_ARCS,

      arcColor: [0.82, 1, 0.27],
      arcWidth: 0.48,
      arcHeight: 0.18,

      scale: 1,
      opacity: 1,
    });

    globeRef.current = globe;

    let animationFrame = 0;
    let destroyed = false;

    const resizeObserver = new ResizeObserver(() => {
      const nextSize = updateSize();

      globe.update({
        width: nextSize * dpr,
        height: nextSize * dpr,
      });
    });

    resizeObserver.observe(wrapper);

    const locations = CDN_NODES.map((node) => ({
      id: node.id,
      lat: (node.location[0] * Math.PI) / 180,
      lng: (node.location[1] * Math.PI) / 180,
    }));

    const animate = () => {
      if (destroyed) return;

      if (pointerDownRef.current === null) {
        velocityRef.current *= 0.93;

        if (!reducedMotion) {
          rotationRef.current += 0.00075 + velocityRef.current;
        }
      }

      const phi = 0.7 + rotationRef.current;
      const theta = 0.16;

      globe.update({
        phi,
        theta,
      });

      /*
       * HTML location labels projected over the WebGL globe.
       */
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);

      const radius = 0.435;

      for (const location of locations) {
        const element = labelRefs.current[location.id];

        if (!element) continue;

        const cosLat = Math.cos(location.lat);

        const x0 = cosLat * Math.sin(location.lng);
        const y0 = Math.sin(location.lat);
        const z0 = cosLat * Math.cos(location.lng);

        const x1 = x0 * cosPhi + z0 * sinPhi;
        const y1 = y0;
        const z1 = -x0 * sinPhi + z0 * cosPhi;

        const y2 = y1 * cosTheta - z1 * sinTheta;
        const z2 = y1 * sinTheta + z1 * cosTheta;

        if (z2 > 0.08) {
          const x = (0.5 + x1 * radius) * 100;
          const y = (0.5 - y2 * radius) * 100;

          const opacity = Math.min(1, Math.max(0, (z2 - 0.08) * 3.2));

          /*
           * Use left/top rather than translate percentages.
           * Translate percentages are based on the label itself,
           * not the globe container.
           */
          element.style.left = `${x}%`;
          element.style.top = `${y}%`;

          element.style.transform = "translate3d(-50%, -115%, 0)";

          element.style.opacity = `${opacity}`;

          element.style.pointerEvents = opacity > 0.55 ? "auto" : "none";
        } else {
          element.style.opacity = "0";
          element.style.pointerEvents = "none";
        }
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      destroyed = true;

      resizeObserver.disconnect();

      cancelAnimationFrame(animationFrame);

      globe.destroy();

      globeRef.current = null;
    };
  }, [reducedMotion]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownRef.current = event.clientX;
    pointerPreviousXRef.current = event.clientX;

    velocityRef.current = 0;

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerDownRef.current === null) return;

    const delta = event.clientX - pointerPreviousXRef.current;

    pointerPreviousXRef.current = event.clientX;

    const movement = delta / 230;

    rotationRef.current += movement;
    velocityRef.current = movement * 0.72;
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* faint center light */}
      <div
        aria-hidden
        className="
          absolute
          left-1/2
          top-[72%]
          size-[260px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-[#d1ff46]/[0.08]
          blur-[90px]

          sm:top-[58%]
          sm:size-[520px]
        "
      />

      <div
        ref={wrapperRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="
          pointer-events-auto
          absolute
          left-1/2

          top-[72%]

          h-[min(430px,112vw)]
          w-[min(430px,112vw)]

          -translate-x-1/2
          -translate-y-1/2

          cursor-grab
          select-none
          touch-none

          active:cursor-grabbing

          sm:top-[58%]
          sm:size-[620px]

          lg:top-[56%]
          lg:size-[760px]
        "
      >
        {/* canvas */}
        <canvas
          ref={canvasRef}
          className="
            block
            size-full

            opacity-0

            transition-opacity
            duration-1000
            ease-out

            will-change-transform
          "
          style={{
            /*
             * This is what gives the phone version the cropped,
             * fading hemisphere from your reference.
             */
            WebkitMaskImage: `
              linear-gradient(
                to bottom,
                black 0%,
                black 57%,
                rgba(0,0,0,.94) 66%,
                rgba(0,0,0,.68) 78%,
                rgba(0,0,0,.22) 91%,
                transparent 100%
              )
            `,
            maskImage: `
              linear-gradient(
                to bottom,
                black 0%,
                black 57%,
                rgba(0,0,0,.94) 66%,
                rgba(0,0,0,.68) 78%,
                rgba(0,0,0,.22) 91%,
                transparent 100%
              )
            `,
          }}
        />

        {/* globe labels */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {CDN_NODES.map((node, index) => {
            const isActive = activeNode === node.id;

            return (
              <div
                key={node.id}
                ref={(element) => {
                  labelRefs.current[node.id] = element;
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveNode(node.id);
                }}
                className={`
                  absolute

                  will-change-[left,top,transform,opacity]

                  transition-opacity
                  duration-150

                  ${index > 4 ? "hidden sm:block" : "block"}
                `}
                style={{
                  opacity: 0,
                }}
              >
                <div
                  className={`
                    flex
                    cursor-pointer
                    items-center
                    gap-1.5

                    whitespace-nowrap

                    rounded-full

                    border

                    px-2
                    py-1

                    text-[9px]
                    font-semibold

                    shadow-[0_8px_25px_-14px_rgba(0,0,0,.3)]

                    backdrop-blur-xl

                    transition-all
                    duration-200

                    sm:px-2.5
                    sm:py-1.5
                    sm:text-[10px]

                    ${
                      isActive
                        ? `
                          scale-[1.04]
                          border-neutral-900
                          bg-neutral-950
                          text-white
                        `
                        : `
                          border-black/[0.08]
                          bg-white/90
                          text-neutral-700

                          hover:border-black/20
                          hover:bg-white
                        `
                    }
                  `}
                >
                  <span
                    className={`
                      size-1.5
                      shrink-0
                      rounded-full

                      ${isActive ? "bg-[#d1ff46]" : "bg-neutral-400"}
                    `}
                  />

                  <span>{node.city}</span>

                  <span
                    className={`
                      hidden
                      text-[8px]
                      font-bold

                      sm:inline

                      ${isActive ? "text-[#d1ff46]" : "text-neutral-400"}
                    `}
                  >
                    {node.latency}
                  </span>
                </div>

                <div
                  className={`
                    mx-auto
                    h-[7px]
                    w-px

                    ${isActive ? "bg-neutral-900/40" : "bg-neutral-500/25"}
                  `}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface MetricItem {
  label: string;
  value: string;
  description: string;
  subtext?: string;
  icon?: React.ReactNode;
}

const DEFAULT_METRICS: MetricItem[] = [
  {
    label: "Uptime SLA",
    value: "99.99%",
    description: "Multi-region failover mesh with zero routing downtime.",
    subtext: "Tier-1 Edge",
    icon: <ShieldCheck className="size-4 text-neutral-800" />,
  },
  {
    label: "Median Latency",
    value: "24ms",
    description: "Real-time edge cache hops directly to local ISP backbones.",
    subtext: "Sub-30ms Global",
    icon: <Zap className="size-4 text-neutral-800" />,
  },
  {
    label: "Cache Hit Ratio",
    value: "96.8%",
    description: "Tiered shielding layers preventing cold origin egress hits.",
    subtext: "Shielded Cache",
    icon: <Activity className="size-4 text-neutral-800" />,
  },
];

// Angled rotations for each card index
const CARD_ROTATIONS = [
  "sm:-rotate-2 hover:rotate-0",
  "sm:rotate-0 hover:-rotate-1",
  "sm:rotate-2 hover:rotate-0",
];

function MetricsSection({
  metrics = DEFAULT_METRICS,
}: {
  metrics?: MetricItem[];
}) {
  return (
    <div className="relative z-40 -mt-2 w-full pb-16 sm:pb-24">
      <div className="mx-auto max-w-7xl px-2 sm:px-3">
        {/* Responsive Grid with Spacing for Angled Offsets */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-6 lg:gap-8 pt-4">
          {metrics.map((metric, index) => {
            const rotationClass = CARD_ROTATIONS[index % CARD_ROTATIONS.length];

            return (
              <div
                key={metric.label}
                className={`group relative flex flex-col justify-between p-6 sm:p-7 bg-white/90 backdrop-blur-md rounded-md shadow-sm border border-black/[0.08] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-md hover:border-black/20 ${rotationClass}`}
              >
                {/* Accent Corner Glow (appears on hover) */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-60"
                  style={{ backgroundColor: "#d1ff46" }}
                />

                {/* Top Section */}
                <div>
                  {/* Top Bar: Icon + Live Pill */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-md border border-black/[0.06] bg-neutral-100/90 transition-colors duration-200 group-hover:bg-[#d1ff46] group-hover:border-black/10">
                        {metric.icon}
                      </span>
                      <span className="font-subheading text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                        {metric.label}
                      </span>
                    </div>

                    {/* Minimalist Live Node Dot */}
                    <div className="flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-neutral-50 px-2 py-0.5 text-[9px] font-semibold text-neutral-600">
                      <span className="relative flex size-1.5">
                        <span
                          className="absolute inline-flex size-full animate-ping rounded-full opacity-75"
                          style={{ backgroundColor: "#d1ff46" }}
                        />
                        <span
                          className="relative inline-flex size-1.5 rounded-full border border-black/20"
                          style={{ backgroundColor: "#d1ff46" }}
                        />
                      </span>
                      Live
                    </div>
                  </div>

                  {/* Main Metric Value & Trend Direction */}
                  <div className="mt-6 flex items-baseline justify-between">
                    <div className="font-heading text-4xl sm:text-[42px] font-black tracking-[-0.04em] text-neutral-950 tabular-nums">
                      {metric.value}
                    </div>

                    <div className="flex size-7 items-center justify-center rounded-md border border-black/[0.06] text-neutral-400 transition-all duration-200 group-hover:text-neutral-950 group-hover:border-black/20">
                      <ArrowUpRight className="size-3.5" />
                    </div>
                  </div>

                  {/* Mini Progress Activity Bars */}
                  <div className="mt-3 flex items-center gap-1">
                    {[100, 100, 85, 95, 100, 90, 100].map((fill, i) => (
                      <span
                        key={i}
                        className="h-1 flex-1 rounded-full bg-neutral-100 overflow-hidden"
                      >
                        <span
                          className="block h-full transition-all duration-300 group-hover:bg-neutral-900 group-hover:first:bg-[#b5e02c]"
                          style={{
                            width: `${fill}%`,
                            backgroundColor: i === 6 ? "#d1ff46" : undefined,
                          }}
                        />
                      </span>
                    ))}
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-xs leading-relaxed text-neutral-500">
                    {metric.description}
                  </p>
                </div>

                {/* Card Bottom: Edge Spec Tag */}
                <div className="mt-6 flex items-center justify-between border-t border-black/[0.06] pt-3  text-[10px] text-neutral-400">
                  <span className="font-sans font-medium text-neutral-600">
                    {metric.subtext || "Global POP"}
                  </span>
                  <span className="font-semibold text-neutral-400">
                    99.9% TARGET
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
