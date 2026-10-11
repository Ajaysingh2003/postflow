"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { BentoCard } from "./FeatureSection";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Platform = "all" | "x" | "linkedin" | "threads";
type DateRange = "7D" | "30D";

type MetricData = {
  impressions: string;
  engagement: string;
  followers: string;
  growth: string;
  topPost: string;
  topEngagement: string;
};

type Point = {
  x: number;
  y: number;
  value: number;
};

/* -------------------------------------------------------------------------- */
/* Platform configuration                                                     */
/* -------------------------------------------------------------------------- */

const PLATFORMS: {
  id: Platform;
  label: string;
  short: string;
}[] = [
  {
    id: "all",
    label: "All platforms",
    short: "All",
  },
  {
    id: "x",
    label: "X",
    short: "𝕏",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    short: "in",
  },
  {
    id: "threads",
    label: "Threads",
    short: "@",
  },
];

/* -------------------------------------------------------------------------- */
/* Demo analytics data                                                        */
/* -------------------------------------------------------------------------- */

const CHART_DATA: Record<
  Platform,
  Record<DateRange, number[]>
> = {
  all: {
    "7D": [18, 23, 22, 26, 24, 33, 41],
    "30D": [
      15, 18, 17, 19, 22, 21, 25,
      23, 26, 29, 27, 33, 36, 41,
    ],
  },

  x: {
    "7D": [7, 9, 8, 11, 10, 12, 15],
    "30D": [
      5, 7, 6, 8, 7, 9, 8,
      10, 9, 12, 10, 13, 12, 15,
    ],
  },

  linkedin: {
    "7D": [9, 11, 12, 13, 11, 17, 20],
    "30D": [
      8, 9, 10, 9, 12, 11, 14,
      12, 16, 15, 14, 18, 19, 20,
    ],
  },

  threads: {
    "7D": [2, 3, 2, 2, 3, 4, 6],
    "30D": [
      2, 2, 3, 2, 3, 3, 3,
      4, 3, 4, 5, 4, 5, 6,
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* KPI data                                                                   */
/* -------------------------------------------------------------------------- */

const METRICS: Record<
  Platform,
  Record<DateRange, MetricData>
> = {
  all: {
    "7D": {
      impressions: "187.4K",
      engagement: "6.8%",
      followers: "+624",
      growth: "+18.6%",
      topPost: "Why consistency beats going viral",
      topEngagement: "9.2%",
    },
    "30D": {
      impressions: "812.6K",
      engagement: "6.4%",
      followers: "+2,418",
      growth: "+24.3%",
      topPost: "Lessons from building in public",
      topEngagement: "11.4%",
    },
  },

  x: {
    "7D": {
      impressions: "68.2K",
      engagement: "5.9%",
      followers: "+218",
      growth: "+12.8%",
      topPost: "Build something people come back to",
      topEngagement: "8.7%",
    },
    "30D": {
      impressions: "294.8K",
      engagement: "5.6%",
      followers: "+842",
      growth: "+19.2%",
      topPost: "A lesson from shipping my SaaS",
      topEngagement: "10.2%",
    },
  },

  linkedin: {
    "7D": {
      impressions: "94.6K",
      engagement: "7.4%",
      followers: "+316",
      growth: "+22.4%",
      topPost: "Why consistency beats going viral",
      topEngagement: "12.8%",
    },
    "30D": {
      impressions: "408.5K",
      engagement: "7.1%",
      followers: "+1,264",
      growth: "+28.6%",
      topPost: "What building products taught me",
      topEngagement: "13.6%",
    },
  },

  threads: {
    "7D": {
      impressions: "24.6K",
      engagement: "6.2%",
      followers: "+90",
      growth: "+16.8%",
      topPost: "Small improvements compound",
      topEngagement: "8.4%",
    },
    "30D": {
      impressions: "109.3K",
      engagement: "6.1%",
      followers: "+312",
      growth: "+21.7%",
      topPost: "The best ideas start as simple notes",
      topEngagement: "9.6%",
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const ROTATE_INTERVAL = 8000;
const CURSOR_INTERVAL = 1600;

const CHART_HEIGHT = 100;

const CHART_LABELS: Record<DateRange, string[]> = {
  "7D": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  "30D": ["Day 1", "Day 7", "Day 14", "Day 21", "Day 30"],
};

const ease = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------------------- */
/* Chart helpers                                                              */
/* -------------------------------------------------------------------------- */

function getPoints(values: number[]): Point[] {
  const max = Math.max(...values, 1) * 1.18;

  return values.map((value, index) => ({
    x:
      values.length === 1
        ? 50
        : (index / (values.length - 1)) * 100,

    y: 86 - (value / max) * 72,

    value,
  }));
}

function createSmoothPath(points: Point[]) {
  if (!points.length) return "";

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];

    const middleX = (current.x + next.x) / 2;

    path += `
      C ${middleX} ${current.y},
        ${middleX} ${next.y},
        ${next.x} ${next.y}
    `;
  }

  return path;
}

function formatChartValue(value: number) {
  return `${value.toFixed(1).replace(".0", "")}K`;
}

/* -------------------------------------------------------------------------- */
/* Platform symbol                                                            */
/* -------------------------------------------------------------------------- */

function PlatformSymbol({
  platform,
}: {
  platform: Platform;
}) {
  if (platform === "all") {
    return (
      <BarChart3 className="size-3.5" />
    );
  }

  if (platform === "linkedin") {
    return (
      <span className="text-[11px] font-bold leading-none">
        in
      </span>
    );
  }

  if (platform === "threads") {
    return (
      <span className="text-[14px] font-semibold leading-none">
        @
      </span>
    );
  }

  return (
    <span className="text-[14px] leading-none">
      𝕏
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI card                                                                   */
/* -------------------------------------------------------------------------- */

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 px-3 py-2.5 sm:px-4">
      <p
        className="
          truncate font-subheading
          text-[9.5px] font-medium
          text-[#8b9290]
        "
      >
        {label}
      </p>

      <div className="mt-1 flex items-center gap-1.5">
        <span
          className="
            truncate font-heading
            text-[17px] font-semibold
            leading-none tracking-[-0.045em]
            tabular-nums text-[#191d1a]
            sm:text-[19px]
          "
        >
          {value}
        </span>
      </div>

      {detail && (
        <p
          className="
            mt-1 text-[9px]
            font-medium text-[#548b66]
          "
        >
          {detail}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Interactive analytics chart                                                */
/* -------------------------------------------------------------------------- */

function AnalyticsChart({
  platform,
  range,
  values,
  reducedMotion,
}: {
  platform: Platform;
  range: DateRange;
  values: number[];
  reducedMotion: boolean;
}) {
  const plotRef = useRef<HTMLDivElement>(null);

  const gradientId = useId().replace(/:/g, "");

  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);

  const [autoIndex, setAutoIndex] =
    useState(0);

  const points = useMemo(
    () => getPoints(values),
    [values],
  );

  const linePath = useMemo(
    () => createSmoothPath(points),
    [points],
  );

  const areaPath = `${linePath} L 100 ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  const selectedIndex =
    hoveredIndex !== null
      ? Math.min(hoveredIndex, points.length - 1)
      : autoIndex % points.length;

  const selectedPoint = points[selectedIndex];

  /* Automatically highlight different points */

  useEffect(() => {
    if (reducedMotion) return;

    const interval = window.setInterval(() => {
      setAutoIndex(
        (current) => (current + 1) % values.length,
      );
    }, CURSOR_INTERVAL);

    return () => window.clearInterval(interval);
  }, [values.length, reducedMotion]);

  /* Reset pointer on dataset change */

  useEffect(() => {
    setHoveredIndex(null);
    setAutoIndex(0);
  }, [platform, range]);

  const onPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const rect =
      plotRef.current?.getBoundingClientRect();

    if (!rect) return;

    const relativeX =
      (event.clientX - rect.left) / rect.width;

    const index = Math.round(
      Math.max(0, Math.min(1, relativeX)) *
        (points.length - 1),
    );

    setHoveredIndex(index);
  };

  const onKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight"
    ) {
      return;
    }

    event.preventDefault();

    const direction =
      event.key === "ArrowRight" ? 1 : -1;

    setHoveredIndex((current) => {
      const next =
        (current ?? selectedIndex) + direction;

      return Math.max(
        0,
        Math.min(points.length - 1, next),
      );
    });
  };

  const label =
    range === "7D"
      ? CHART_LABELS["7D"][selectedIndex]
      : `Day ${
          Math.round(
            (selectedIndex / (points.length - 1)) * 29,
          ) + 1
        }`;

  return (
    <div className="px-3.5 pb-2 pt-2.5 sm:px-4">
      {/* Chart heading */}

      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p
            className="
              text-[10.5px] font-semibold
              text-[#303631]
            "
          >
            Impressions over time
          </p>

          <p className="mt-0.5 text-[9px] text-[#a0a6a1]">
            Your content performance
          </p>
        </div>

        {/* Live point readout */}

        <div className="flex items-center gap-1.5">
          <span
            className="
              size-1.5 rounded-full
              bg-[#548b66]
            "
          />

          <span
            className="
              text-[10px] font-medium
              tabular-nums text-[#626b65]
            "
          >
            {formatChartValue(selectedPoint.value)}
          </span>

          <span className="text-[9px] text-[#9ba29c]">
            {label}
          </span>
        </div>
      </div>

      {/* Graph */}

      <div
        ref={plotRef}
        role="slider"
        tabIndex={0}
        aria-label="Explore impressions over time"
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={selectedIndex}
        aria-valuetext={`${label}, ${formatChartValue(selectedPoint.value)} impressions`}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerCancel={() => setHoveredIndex(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHoveredIndex(null)}
        className="
          relative h-[83px] w-full
          cursor-crosshair touch-pan-y
          select-none outline-none
          focus-visible:rounded
          focus-visible:ring-2
          focus-visible:ring-[#548b66]/40
          sm:h-[91px]
        "
      >
        <AnimatePresence mode="wait">
          <motion.svg
            key={`${platform}-${range}`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            initial={
              reducedMotion
                ? false
                : { opacity: 0, y: 5 }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -3,
            }}
            transition={{
              duration: reducedMotion ? 0 : 0.35,
              ease,
            }}
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#83af91"
                  stopOpacity="0.26"
                />

                <stop
                  offset="100%"
                  stopColor="#83af91"
                  stopOpacity="0.01"
                />
              </linearGradient>
            </defs>

            {/* Grid */}

            {[20, 50, 80].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                stroke="#e8ebe8"
                strokeWidth="1"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Area */}

            <motion.path
              d={areaPath}
              fill={`url(#${gradientId})`}
              initial={
                reducedMotion
                  ? false
                  : { opacity: 0 }
              }
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
              }}
            />

            {/* Line */}

            <motion.path
              d={linePath}
              fill="none"
              stroke="#477e5b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={
                reducedMotion
                  ? false
                  : { pathLength: 0 }
              }
              animate={{ pathLength: 1 }}
              transition={{
                duration: reducedMotion ? 0 : 1.15,
                ease,
              }}
            />

            {/* Active cursor */}

            <line
              x1={selectedPoint.x}
              x2={selectedPoint.x}
              y1={selectedPoint.y}
              y2="100"
              stroke="#477e5b"
              strokeOpacity="0.3"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />

            {/* Active point */}

            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r="2.6"
              fill="#ffffff"
              stroke="#477e5b"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />

            <circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r="1"
              fill="#477e5b"
            />
          </motion.svg>
        </AnimatePresence>
      </div>

      {/* X-axis */}

      <div
        aria-hidden="true"
        className="
          mt-1 flex items-center
          justify-between text-[9px]
          text-[#a3aaa4]
        "
      >
        {CHART_LABELS[range].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Analytics dashboard                                                        */
/* -------------------------------------------------------------------------- */

function AnalyticsDashboard() {
  const reducedMotion = !!useReducedMotion();

  const [platform, setPlatform] =
    useState<Platform>("all");

  const [range, setRange] =
    useState<DateRange>("7D");

  const [cycle, setCycle] = useState(0);

  const metrics = METRICS[platform][range];
  const chartValues = CHART_DATA[platform][range];

  /*
   * Infinite platform rotation.
   *
   * All -> X -> LinkedIn -> Threads -> All
   *
   * Continues even while hovering.
   * Manual selections restart the countdown.
   */

  useEffect(() => {
    if (reducedMotion) return;

    const timeout = window.setTimeout(() => {
      setPlatform((current) => {
        const currentIndex = PLATFORMS.findIndex(
          (item) => item.id === current,
        );

        return PLATFORMS[
          (currentIndex + 1) % PLATFORMS.length
        ].id;
      });
    }, ROTATE_INTERVAL);

    return () => window.clearTimeout(timeout);
  }, [platform, cycle, reducedMotion]);

  const choosePlatform = (next: Platform) => {
    setPlatform(next);
    setCycle((current) => current + 1);
  };

  return (
    <div
      className="
        relative mx-auto w-full
        max-w-[520px]
        overflow-hidden rounded-[14px]
        border border-[#e7eae7]
        bg-white
        shadow-[0_14px_35px_-22px_rgba(20,35,25,0.2),0_2px_8px_rgba(20,35,25,0.035)]
      "
    >
      {/* Dashboard toolbar */}

      <div
        className="
          flex h-[41px] items-center
          justify-between gap-2
          border-b border-black/[0.06]
          px-3.5 sm:px-4
        "
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="
              flex size-6 shrink-0
              items-center justify-center
              rounded-md bg-[#f3f5f3]
            "
          >
            <BarChart3 className="size-3 text-[#444b45]" />
          </span>

          <span
            className="
              truncate text-[11px]
              font-semibold text-[#303630]
            "
          >
            Performance overview
          </span>
        </div>

        {/* Date filters */}

        <div
          role="group"
          aria-label="Analytics date range"
          className="
            flex shrink-0 items-center
            rounded-md border
            border-black/[0.06]
            bg-[#f6f7f6] p-[2px]
          "
        >
          {(["7D", "30D"] as DateRange[]).map(
            (item) => {
              const active = range === item;

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(item)}
                  className={`
                    rounded-[4px]
                    px-2.5 py-1
                    text-[9.5px]
                    font-medium
                    transition-all duration-200
                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#548b66]/40
                    ${
                      active
                        ? "bg-white text-[#242a25] shadow-sm"
                        : "text-[#9aa19b] hover:text-[#444b45]"
                    }
                  `}
                >
                  {item}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Platform tabs */}

      <div
        role="group"
        aria-label="Filter analytics by platform"
        className="
          flex items-center gap-1
          border-b border-black/[0.055]
          px-3 py-1.5 sm:px-3.5
        "
      >
        {PLATFORMS.map((item) => {
          const active = item.id === platform;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                choosePlatform(item.id)
              }
              aria-pressed={active}
              className={`
                flex min-w-0 items-center
                justify-center gap-1.5
                rounded-md px-2.5 py-1.5
                text-[10px] font-medium
                transition-colors duration-200
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-[#548b66]/40
                ${
                  active
                    ? "bg-[#232823] text-white"
                    : "text-[#8f9790] hover:bg-[#f4f5f3] hover:text-[#343a35]"
                }
              `}
            >
              <PlatformSymbol platform={item.id} />

              <span
                className={
                  item.id !== "all"
                    ? "hidden min-[420px]:inline"
                    : ""
                }
              >
                {item.id === "all" ? "All" : item.label}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="size-1.5 rounded-full bg-[#69a57b]" />

          <span className="text-[9px] text-[#9aa19c]">
            Overview
          </span>
        </div>
      </div>

      {/* KPI metrics */}

      <div
        className="
          grid grid-cols-3
          divide-x divide-black/[0.06]
          border-b border-black/[0.06]
        "
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${platform}-${range}-metrics`}
            className="col-span-3 grid grid-cols-3 divide-x divide-black/[0.06]"
            initial={
              reducedMotion
                ? false
                : { opacity: 0, y: 5 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              duration: reducedMotion ? 0 : 0.25,
            }}
          >
            <Metric
              label="Impressions"
              value={metrics.impressions}
              detail={metrics.growth}
            />

            <Metric
              label="Engagement"
              value={metrics.engagement}
              detail="Engagement rate"
            />

            <Metric
              label="New followers"
              value={metrics.followers}
              detail="Net growth"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chart */}

      <AnalyticsChart
        platform={platform}
        range={range}
        values={chartValues}
        reducedMotion={reducedMotion}
      />

      {/* Top-performing post */}

      <div
        className="
          flex min-h-[38px]
          items-center justify-between
          gap-2 border-t
          border-black/[0.06]
          bg-[#fafbfa]
          px-3.5 py-2 sm:px-4
        "
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="
              flex size-5 shrink-0
              items-center justify-center
              rounded-md bg-[#eaf3ec]
            "
          >
            <Sparkles className="size-3 text-[#508361]" />
          </span>

          <div className="min-w-0">
            <p
              className="
                text-[9px] font-medium
                text-[#929a94]
              "
            >
              Top-performing post
            </p>

            <p
              className="
                truncate text-[10px]
                font-medium text-[#3b423c]
              "
            >
              {metrics.topPost}
            </p>
          </div>
        </div>

        <div
          className="
            flex shrink-0 items-center
            gap-0.5 text-[10px]
            font-semibold text-[#548765]
          "
        >
          {metrics.topEngagement}

          <ArrowUpRight className="size-3" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feature Card Three                                                         */
/* -------------------------------------------------------------------------- */

export function FeatureCardThree() {
  return (
    <BentoCard
      className="
      !h-[460px] sm:!h-[480px]
        group relative isolate
        flex z!h-[455px] min-w-0
        flex-col overflow-hidden
        !border-black/[0.07]
        !bg-white
        text-[#171717]
      "
    >
      {/* Background */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute inset-0 overflow-hidden
        "
      >
        {/* Ambient glow */}

        <div
          className="
            absolute bottom-[-150px]
            left-1/2 h-[300px]
            w-[85%] -translate-x-1/2
            rounded-full
            bg-[#edf1ed]/75
            blur-[95px]
          "
        />

        {/* Soft neutral radial gradient */}

        <div
          className="
            absolute inset-0
            bg-[radial-gradient(ellipse_at_50%_100%,rgba(0,0,0,0.018),transparent_65%)]
          "
        />
      </div>

      {/* Feature heading */}

      <div
        className="
          relative z-10 shrink-0
          px-5 pt-5 sm:px-6 sm:pt-6
        "
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="
                flex size-7 items-center
                justify-center rounded-lg
                border border-black/[0.07]
                bg-[#f7f8f7]
              "
            >
              <BarChart3 className="size-3.5 text-[#404540]" />
            </span>

            <span
              className="
                text-[10px] font-semibold
                uppercase tracking-[0.12em]
                text-[#888e89]
              "
            >
              ADVANCED ANALYTICS
            </span>
          </div>

          <span
            className="
              flex shrink-0 items-center
              gap-1.5 rounded-full
              border border-black/[0.07]
              bg-[#f9faf9]
              px-2.5 py-1.5
            "
          >
            <TrendingUp className="size-3 text-[#608c6c]" />

            <span className="text-[9px] font-medium text-[#737b75]">
              Insights
            </span>
          </span>
        </div>

        {/* Title */}

        <h3
          className="
            font-heading mt-4 max-w-[370px]
            text-[22px] font-semibold
            leading-[1.16]
            tracking-[-0.04em]
            text-[#181b19]
            sm:text-[25px]
          "
        >
          Know what works.
          <br />

          <span className="text-[#9b9f9c]">
            Grow faster.
          </span>
        </h3>

        {/* Description */}

        <p
          className="
            font-subheading mt-2
            max-w-[370px]
            text-[12px] leading-[1.65]
            text-[#848b86]
          "
        >
          Track engagement, understand your audience,
          and discover which content performs best.
        </p>
      </div>

      {/* Analytics preview */}

      <div
        className="
          relative z-10 mt-auto
          min-h-0 px-3.5
          pb-4 pt-3 sm:px-5
        "
      >
        {/* Preview glow */}

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            absolute left-1/2 top-3
            h-[160px] w-[75%]
            -translate-x-1/2
            rounded-full
            bg-[#e8eee9]/60
            blur-[55px]
          "
        />

        {/* Dashboard */}

        <div className="relative">
          <AnalyticsDashboard />
        </div>

        {/* Footer */}

        <div
          className="
            mt-2.5 flex items-center
            justify-between gap-3 px-1
          "
        >
          <div
            className="
              flex items-center gap-1.5
              text-[10px] text-[#959b96]
            "
          >
            <Sparkles className="size-3" />

            Insights that help you grow.
          </div>

          <span className="text-[9px] text-[#a3a9a4]">
            Illustrative data
          </span>
        </div>
      </div>
    </BentoCard>
  );
}