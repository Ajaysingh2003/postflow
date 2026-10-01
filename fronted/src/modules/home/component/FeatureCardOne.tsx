"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Captions,
  Check,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  BentoCard,
  BentoHeader,
  CardBottomFade,
} from "./FeatureSection";

const DURATION = 312;
const START = 96;

const SPEEDS = [1, 1.25, 1.5, 2];

const CHAPTERS = [
  {
    at: 0,
    title: "Intro",
    caption: "Welcome to the Q3 launch.",
  },
  {
    at: 52,
    title: "Uploads",
    caption: "Every upload lands in storage first.",
  },
  {
    at: 118,
    title: "Transcoding",
    caption: "Each file becomes an adaptive ladder.",
  },
  {
    at: 196,
    title: "Delivery",
    caption: "Segments are cached close to viewers.",
  },
  {
    at: 254,
    title: "Recap",
    caption: "That's the whole pipeline.",
  },
].map((chapter, index, all) => ({
  ...chapter,
  len: (all[index + 1]?.at ?? DURATION) - chapter.at,
}));

const ACCENTS = [
  {
    hex: "#B3E61D",
    name: "Lime",
  },
  {
    hex: "#FF7A45",
    name: "Orange",
  },
  {
    hex: "#5BC0FF",
    name: "Sky",
  },
  {
    hex: "#FF6B9A",
    name: "Pink",
  },
];

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(
    Math.floor(seconds % 60),
  ).padStart(2, "0")}`;

const clamp = (
  value: number,
  min: number,
  max: number,
) => Math.min(max, Math.max(min, value));

const chapterAt = (time: number) =>
  CHAPTERS.reduce(
    (current, chapter, index) =>
      time >= chapter.at ? index : current,
    0,
  );

const chapterFill = (time: number, index: number) =>
  clamp(
    (time - CHAPTERS[index].at) / CHAPTERS[index].len,
    0,
    1,
  ) * 100;

function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map(
      (index) =>
        parseInt(hex.slice(index, index + 2), 16) / 255,
    )
    .map((value) =>
      value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4,
    );

  const luminance =
    0.2126 * r +
    0.7152 * g +
    0.0722 * b;

  return luminance > 0.18 ? "#11120e" : "#ffffff";
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export function FeatureCardOne() {
  const [accent, setAccent] = useState(ACCENTS[0].hex);
  const [playing, setPlaying] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [chapter, setChapter] = useState(
    chapterAt(START),
  );
  const [inView, setInView] = useState(false);
  const [controlsVisible, setControlsVisible] =
    useState(true);

  const frameRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const knobs = useRef<(HTMLSpanElement | null)[]>([]);

  const timeLabel = useRef<HTMLSpanElement>(null);
  const time = useRef(START);

  const speed = SPEEDS[speedIndex];

  const onAccent = readableOn(accent);

  const paint = useCallback((newTime: number) => {
    time.current = newTime;

    const activeChapter = chapterAt(newTime);

    CHAPTERS.forEach((_, index) => {
      const fill = fills.current[index];
      const knob = knobs.current[index];

      if (fill) {
        fill.style.width = `${chapterFill(
          newTime,
          index,
        )}%`;
      }

      if (knob) {
        knob.style.opacity =
          index === activeChapter ? "1" : "0";
      }
    });

    if (timeLabel.current) {
      timeLabel.current.textContent =
        formatTime(newTime);
    }

    barRef.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(newTime)),
    );

    barRef.current?.setAttribute(
      "aria-valuetext",
      `${formatTime(newTime)} of ${formatTime(
        DURATION,
      )}`,
    );

    setChapter(activeChapter);
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;

    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const delta = (now - previous) / 1000;

      previous = now;

      paint(
        (time.current + delta * speed) % DURATION,
      );

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [inView, paint, playing, speed]);

  useEffect(() => {
    const element = frameRef.current;

    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      {
        threshold: 0.25,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
    ) {
      setPlaying(false);
    }
  }, []);

  const seekTo = (clientX: number) => {
    const rect =
      barRef.current?.getBoundingClientRect();

    if (!rect) return;

    const percentage =
      (clientX - rect.left) / rect.width;

    paint(
      clamp(
        percentage * DURATION,
        0,
        DURATION - 0.01,
      ),
    );
  };

  const handleBarKey = (
    event: React.KeyboardEvent,
  ) => {
    const step =
      event.key === "ArrowRight"
        ? 5
        : event.key === "ArrowLeft"
          ? -5
          : 0;

    if (!step) return;

    event.preventDefault();

    paint(
      clamp(
        time.current + step,
        0,
        DURATION - 0.01,
      ),
    );
  };

  return (
    <BentoCard className="flex flex-col overflow-hidden bg-white">
      <BentoHeader
        icon={Play}
        badge="Player"
        title="A player that matches your brand"
        description="Customize your player, chapters, colors and playback behavior without maintaining your own video UI."
        linkText="Customize the player ↗"
      />

      <div className="relative mt-2 flex-1 px-4 pb-6 sm:px-6">
        {/* Ambient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-8 h-[190px] w-[68%] -translate-x-1/2 rounded-full blur-[90px] transition-colors duration-700"
          style={{
            backgroundColor: accent,
            opacity: 0.09,
          }}
        />

        <div
          ref={frameRef}
          className="relative z-10 mx-auto w-full max-w-[620px]"
        >
          {/* PLAYER */}
          <div
            className="group/player relative overflow-hidden rounded-[18px] border border-black/[0.09] bg-[#090b0d] shadow-[0_22px_48px_-26px_rgba(15,23,42,0.5)]"
            onMouseEnter={() =>
              setControlsVisible(true)
            }
            onMouseLeave={() =>
              playing && setControlsVisible(false)
            }
            onMouseMove={() =>
              setControlsVisible(true)
            }
          >
            <div className="relative aspect-video overflow-hidden">
              {/* cinematic background */}
              <div
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(180deg,#101825_0%,#27364c_42%,#b4775e_71%,#dfa377_100%)]"
              />

              {/* sky glow */}
              <div
                aria-hidden
                className="absolute left-[55%] top-[22%] size-[150px] -translate-x-1/2 rounded-full bg-orange-200/25 blur-[35px]"
              />

              {/* distant mountains */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-[15%] h-[48%] bg-[#313849]/80 [clip-path:polygon(0_72%,10%_55%,20%_64%,31%_37%,40%_59%,51%_28%,60%_54%,71%_39%,82%_62%,91%_44%,100%_57%,100%_100%,0_100%)]"
              />

              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[35%] bg-[#11161f] [clip-path:polygon(0_52%,12%_35%,23%_53%,35%_25%,46%_46%,59%_27%,70%_50%,83%_33%,100%_55%,100%_100%,0_100%)]"
              />

              {/* subtle vignette */}
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.35)_100%)]"
              />

              {/* subtle film grain */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.05] mix-blend-soft-light"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E\")",
                }}
              />

              {/* top metadata */}
              <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.10] bg-black/30 px-2.5 py-1.5 shadow-sm backdrop-blur-xl">
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: accent,
                      boxShadow: `0 0 9px ${accent}`,
                    }}
                  />

                  <span className="font-subheading text-[10px] font-medium tracking-wide text-white/85">
                    Q3 launch keynote
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="font-subheading rounded-md border border-white/[0.09] bg-black/25 px-2 py-1 text-[10px] font-medium text-white/60 backdrop-blur-xl">
                    4K
                  </span>

                  <span className="font-subheading hidden rounded-md border border-white/[0.09] bg-black/25 px-2 py-1 text-[10px] font-medium text-white/60 backdrop-blur-xl sm:block">
                    HDR
                  </span>
                </div>
              </div>

              {/* center click area */}
              <button
                type="button"
                aria-label={
                  playing ? "Pause video" : "Play video"
                }
                onClick={() =>
                  setPlaying((current) => !current)
                }
                className={`absolute inset-0 z-10 flex items-center justify-center ${focusRing}`}
              >
                <span
                  className={`flex size-12 items-center justify-center rounded-full border border-white/10 shadow-[0_14px_35px_rgba(0,0,0,.28)] backdrop-blur-md transition-all duration-300 ${
                    playing
                      ? "scale-90 opacity-0 group-hover/player:scale-100 group-hover/player:opacity-100"
                      : "scale-100 opacity-100"
                  }`}
                  style={{
                    backgroundColor: accent,
                    color: onAccent,
                  }}
                >
                  {playing ? (
                    <Pause className="size-[18px] fill-current" />
                  ) : (
                    <Play className="ml-0.5 size-[18px] fill-current" />
                  )}
                </span>
              </button>

              {/* captions */}
              {captions && (
                <div className="pointer-events-none absolute inset-x-4 bottom-[4.45rem] z-20 flex justify-center">
                  <span className="max-w-[82%] rounded-md border border-white/[0.08] bg-black/65 px-2.5 py-1 text-center text-xs leading-4 text-white/90 shadow-lg backdrop-blur-md">
                    {CHAPTERS[chapter].caption}
                  </span>
                </div>
              )}

              {/* bottom controls */}
              <div
                className={`absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3.5 pb-3 pt-10 transition-opacity duration-300 sm:px-4 ${
                  controlsVisible || !playing
                    ? "opacity-100"
                    : "opacity-75"
                }`}
              >
                {/* chapter timeline */}
                <div
                  ref={barRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Seek video"
                  aria-valuemin={0}
                  aria-valuemax={DURATION}
                  aria-valuenow={START}
                  aria-valuetext={`${formatTime(
                    START,
                  )} of ${formatTime(DURATION)}`}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(
                      event.pointerId,
                    );

                    seekTo(event.clientX);
                  }}
                  onPointerMove={(event) => {
                    if (event.buttons === 1) {
                      seekTo(event.clientX);
                    }
                  }}
                  onKeyDown={handleBarKey}
                  className={`group/seek flex h-4 cursor-pointer touch-none items-center gap-[3px] ${focusRing}`}
                >
                  {CHAPTERS.map(
                    (chapterItem, index) => (
                      <span
                        key={chapterItem.at}
                        className="relative h-[3px] overflow-visible rounded-full bg-white/25 transition-[height] duration-150 group-hover/seek:h-[5px]"
                        style={{
                          flex: chapterItem.len,
                        }}
                      >
                        <span
                          ref={(element) => {
                            fills.current[index] =
                              element;
                          }}
                          className="absolute inset-y-0 left-0 rounded-full transition-colors duration-300"
                          style={{
                            width: `${chapterFill(
                              START,
                              index,
                            )}%`,
                            backgroundColor: accent,
                          }}
                        >
                          <span
                            ref={(element) => {
                              knobs.current[index] =
                                element;
                            }}
                            className="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full border border-black/10 bg-white opacity-0 shadow-[0_2px_7px_rgba(0,0,0,.35)] transition-opacity"
                            style={{
                              opacity:
                                index ===
                                chapterAt(START)
                                  ? 1
                                  : 0,
                            }}
                          />
                        </span>
                      </span>
                    ),
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2.5 text-white/75">
                    <button
                      type="button"
                      aria-label={
                        playing ? "Pause" : "Play"
                      }
                      onClick={() =>
                        setPlaying(
                          (current) => !current,
                        )
                      }
                      className={`shrink-0 transition hover:text-white ${focusRing}`}
                    >
                      {playing ? (
                        <Pause className="size-3.5 fill-current" />
                      ) : (
                        <Play className="size-3.5 fill-current" />
                      )}
                    </button>

                    <button
                      type="button"
                      aria-label={
                        muted ? "Unmute" : "Mute"
                      }
                      aria-pressed={muted}
                      onClick={() =>
                        setMuted(
                          (current) => !current,
                        )
                      }
                      className={`shrink-0 transition hover:text-white ${focusRing}`}
                    >
                      {muted ? (
                        <VolumeX className="size-3.5" />
                      ) : (
                        <Volume2 className="size-3.5" />
                      )}
                    </button>

                    <span className="shrink-0 text-[11px] tabular-nums text-white/55">
                      <span ref={timeLabel}>
                        {formatTime(START)}
                      </span>
                      <span className="mx-1 text-white/25">
                        /
                      </span>
                      {formatTime(DURATION)}
                    </span>

                    <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
                      <span
                        className="size-1.5 shrink-0 rounded-full transition-colors"
                        style={{
                          backgroundColor: accent,
                        }}
                      />

                      <span className="font-subheading truncate text-[11px] font-medium text-white/55">
                        {CHAPTERS[chapter].title}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5 text-white/60">
                    <button
                      type="button"
                      aria-label={`Playback speed ${speed}x`}
                      onClick={() =>
                        setSpeedIndex(
                          (index) =>
                            (index + 1) %
                            SPEEDS.length,
                        )
                      }
                      className={`font-subheading min-w-6 text-[11px] font-semibold tabular-nums transition hover:text-white ${focusRing}`}
                    >
                      {speed}×
                    </button>

                    <button
                      type="button"
                      aria-label="Captions"
                      aria-pressed={captions}
                      onClick={() =>
                        setCaptions(
                          (current) => !current,
                        )
                      }
                      className={`relative transition hover:text-white ${focusRing}`}
                      style={{
                        color: captions
                          ? accent
                          : undefined,
                      }}
                    >
                      <Captions className="size-3.5" />

                      {captions && (
                        <span
                          className="absolute -bottom-1 left-1/2 h-[2px] w-2.5 -translate-x-1/2 rounded-full"
                          style={{
                            backgroundColor: accent,
                          }}
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      aria-label="Fullscreen"
                      className={`transition hover:text-white ${focusRing}`}
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CUSTOMIZER */}
          <div className="relative z-20 mx-auto -mt-[1px] flex w-[91%] items-center justify-between gap-3 rounded-b-xl border border-t-0 border-black/[0.08] bg-white px-3 py-2.5 shadow-[0_10px_24px_-17px_rgba(15,23,42,.38)] sm:w-[86%]">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: `${accent}1c`,
                }}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor: accent,
                  }}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-xs font-semibold text-slate-900">
                    Player accent
                  </span>

                  <span className="font-subheading hidden items-center gap-1 text-[10px] text-emerald-600 sm:flex">
                    <Check className="size-2.5" />
                    Live
                  </span>
                </div>

                <span className="font-subheading block text-[10px] uppercase text-slate-400">
                  {accent}
                </span>
              </div>
            </div>

            <div
              role="group"
              aria-label="Accent color"
              className="flex items-center gap-0.5 rounded-lg border border-black/[0.05] bg-slate-50 p-0.5"
            >
              {ACCENTS.map((color) => {
                const active =
                  accent === color.hex;

                return (
                  <button
                    key={color.hex}
                    type="button"
                    aria-label={color.name}
                    aria-pressed={active}
                    onClick={() =>
                      setAccent(color.hex)
                    }
                    className={`relative grid size-7 place-items-center rounded-md transition-all ${
                      active
                        ? "bg-white shadow-sm ring-1 ring-black/[0.06]"
                        : "hover:bg-white/70"
                    }`}
                  >
                    <span
                      className={`size-3.5 rounded-full border border-black/[0.08] transition-transform ${
                        active
                          ? "scale-100"
                          : "scale-90"
                      }`}
                      style={{
                        backgroundColor: color.hex,
                      }}
                    />

                    {active && (
                      <span
                        className="absolute -bottom-[1px] left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full"
                        style={{
                          backgroundColor: color.hex,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* tiny implementation hint */}
          <div className="mx-auto mt-2 flex w-[82%] items-center justify-center">
            <code className="font-subheading truncate text-[10px] text-slate-400">
              {`<Player accent="${accent.toLowerCase()}" chapters />`}
            </code>
          </div>
        </div>

        <CardBottomFade />
      </div>
    </BentoCard>
  );
}
