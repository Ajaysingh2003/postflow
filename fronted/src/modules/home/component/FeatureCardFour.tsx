"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  FileVideo2,
  LoaderCircle,
  Play,
  Radio,
  UploadCloud,
} from "lucide-react";

import {
  BentoCard,
  BentoHeader,
  CardBottomFade,
} from "./FeatureSection";

const CODE = `const video = await vortex.videos.create({
  source: upload.id,
  playback: "adaptive_hls",
  security: "signed_tokens"
});`;

const workflow = [
  {
    icon: UploadCloud,
    title: "Upload received",
    description: "keynote-4k.mp4",
  },
  {
    icon: LoaderCircle,
    title: "Transcoding video",
    description: "Adaptive bitrate ladder",
  },
  {
    icon: Play,
    title: "Ready to stream",
    description: "Global HLS playback",
  },
] as const;

export function FeatureCardFour() {
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        return (current + 1) % workflow.length;
      });
    }, 1900);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(CODE);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <BentoCard className="relative flex flex-col overflow-hidden bg-background">
      <BentoHeader
        icon={Code2}
        badge="Developer first"
        title="Video infrastructure, made for code"
        description="Upload, process, secure and deliver video with a simple API built directly for your stack."
      />

      <div className="relative mt-1 flex-1 px-4 pb-6 sm:px-6">
        {/* ambient background */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[45%] h-52 w-[65%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B3E61D]/[0.04] blur-[95px]"
        />

        <div className="relative z-10 mx-auto w-full max-w-[630px]">
          {/* main developer window */}
          <div className="relative overflow-hidden rounded-[18px] border border-black/10 bg-[#0c0e0b] shadow-[0_26px_58px_-32px_rgba(0,0,0,0.68)]">
            {/* subtle moving sheen */}
            {!reducedMotion && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 z-30 w-20 bg-gradient-to-r from-transparent via-white/[0.022] to-transparent blur-xl"
                initial={{
                  x: -140,
                }}
                animate={{
                  x: 760,
                }}
                transition={{
                  duration: 7,
                  repeat: Infinity,
                  repeatDelay: 2.5,
                  ease: "linear",
                }}
              />
            )}

            {/* mac title bar */}
            <div className="relative z-20 flex h-10 items-center border-b border-white/[0.07] bg-[#11130f] px-3.5">
              {/* macOS traffic lights */}
              <div className="flex items-center gap-[7px]">
                <span className="size-[10px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.28)]" />

                <span className="size-[10px] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.24)]" />

                <span className="relative size-[10px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,.24)]">
                  {!reducedMotion && (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      animate={{
                        boxShadow: [
                          "0 0 0px rgba(40,200,64,0)",
                          "0 0 7px rgba(40,200,64,.28)",
                          "0 0 0px rgba(40,200,64,0)",
                        ],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                </span>
              </div>

              <div className="ml-4 h-4 w-px bg-white/[0.07]" />

              <div className="ml-3 flex min-w-0 items-center gap-2">
                <Code2 className="size-3 shrink-0 text-white/35" />

                <span className="font-subheading truncate text-[11px] text-white/45">
                  create-video.ts
                </span>

                <span className="font-subheading hidden rounded-[4px] border border-white/[0.06] bg-white/[0.035] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/25 sm:inline">
                  TypeScript
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="font-subheading ml-auto flex h-6 min-w-[52px] items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.035] px-2 text-[10px] text-white/40 transition hover:bg-white/[0.07] hover:text-white/75"
              >
                <AnimatePresence
                  mode="wait"
                  initial={false}
                >
                  {copied ? (
                    <motion.span
                      key="copied"
                      initial={{
                        opacity: 0,
                        y: 2,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                        y: -2,
                      }}
                      className="flex items-center gap-1.5 text-emerald-400"
                    >
                      <Check className="size-2.5" />
                      Copied
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{
                        opacity: 0,
                      }}
                      animate={{
                        opacity: 1,
                      }}
                      exit={{
                        opacity: 0,
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <Copy className="size-2.5" />
                      Copy
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>

            <div className="grid min-h-[228px] grid-cols-1 md:grid-cols-[1.12fr_.88fr]">
              {/* code editor */}
              <div className="relative overflow-hidden border-b border-white/[0.07] md:border-b-0 md:border-r">
                {/* gutter */}
                <div className="absolute bottom-0 left-0 top-0 w-9 border-r border-white/[0.05] bg-black/[0.10]" />

                <div className="relative px-3 py-4 pl-11">
                  <div className="text-[11px] leading-[1.9]">
                    <CodeLine
                      number={1}
                      active={false}
                    >
                      <span className="text-[#c678dd]">
                        const
                      </span>{" "}
                      <span className="text-[#e8e8e3]">
                        video
                      </span>{" "}
                      <span className="text-white/35">
                        =
                      </span>{" "}
                      <span className="text-[#61afef]">
                        await
                      </span>{" "}
                      <span className="text-[#e8e8e3]">
                        vortex.videos
                      </span>
                      <span className="text-white/40">
                        .
                      </span>
                      <span className="text-[#B3E61D]">
                        create
                      </span>
                      <span className="text-white/60">
                        {"({"}
                      </span>
                    </CodeLine>

                    <CodeLine
                      number={2}
                      active={activeStep === 0}
                    >
                      <span className="text-[#e5c07b]">
                        source
                      </span>

                      <span className="text-white/40">
                        :
                      </span>{" "}

                      <span className="text-[#abb2bf]">
                        upload
                      </span>

                      <span className="text-white/40">
                        .
                      </span>

                      <span className="text-[#61afef]">
                        id
                      </span>

                      <span className="text-white/35">
                        ,
                      </span>
                    </CodeLine>

                    <CodeLine
                      number={3}
                      active={activeStep === 1}
                    >
                      <span className="text-[#e5c07b]">
                        playback
                      </span>

                      <span className="text-white/40">
                        :
                      </span>{" "}

                      <span className="text-[#98c379]">
                        "adaptive_hls"
                      </span>

                      <span className="text-white/35">
                        ,
                      </span>
                    </CodeLine>

                    <CodeLine
                      number={4}
                      active={activeStep === 1}
                    >
                      <span className="text-[#e5c07b]">
                        security
                      </span>

                      <span className="text-white/40">
                        :
                      </span>{" "}

                      <span className="text-[#98c379]">
                        "signed_tokens"
                      </span>
                    </CodeLine>

                    <CodeLine
                      number={5}
                      active={false}
                    >
                      <span className="text-white/60">
                        {"});"}
                      </span>
                    </CodeLine>

                    <CodeLine
                      number={6}
                      active={activeStep === 2}
                    >
                      <span className="text-white/20">
                        //
                      </span>{" "}

                      <span className="text-white/35">
                        playback ready worldwide
                      </span>
                    </CodeLine>
                  </div>

                  {/* editor footer */}
                  <div className="mt-4 flex items-center border-t border-white/[0.06] pt-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex size-1.5">
                        {!reducedMotion && (
                          <motion.span
                            className="absolute inline-flex size-full rounded-full bg-emerald-400"
                            animate={{
                              scale: [1, 2.1, 1],
                              opacity: [0.4, 0, 0.4],
                            }}
                            transition={{
                              duration: 2.2,
                              repeat: Infinity,
                              ease: "easeOut",
                            }}
                          />
                        )}

                        <span className="relative size-1.5 rounded-full bg-emerald-400" />
                      </span>

                      <span className="font-subheading text-[10px] text-white/35">
                        API authenticated
                      </span>
                    </div>

                    <div className="font-subheading ml-auto flex items-center gap-3 text-[9px] text-white/20">
                      <span>Ln 6</span>
                      <span>UTF-8</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* request lifecycle */}
              <div className="relative overflow-hidden bg-[#11130f] p-3.5">
                <div className="relative mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-heading text-xs font-semibold text-white/85">
                      Request lifecycle
                    </p>

                    <p className="font-subheading mt-0.5 text-[10px] text-white/30">
                      POST /v1/videos
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full border border-[#B3E61D]/10 bg-[#B3E61D]/[0.05] px-2 py-1">
                    <span className="relative flex size-1.5">
                      {!reducedMotion && (
                        <motion.span
                          className="absolute inline-flex size-full rounded-full bg-[#B3E61D]"
                          animate={{
                            scale: [1, 2.1],
                            opacity: [0.5, 0],
                          }}
                          transition={{
                            duration: 1.45,
                            repeat: Infinity,
                            ease: "easeOut",
                          }}
                        />
                      )}

                      <span className="relative size-1.5 rounded-full bg-[#B3E61D]" />
                    </span>

                    <AnimatePresence mode="wait">
                      <motion.span
                        key={activeStep}
                        initial={{
                          opacity: 0,
                          y: 2,
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                        }}
                        exit={{
                          opacity: 0,
                          y: -2,
                        }}
                        transition={{
                          duration: 0.2,
                        }}
                        className="font-subheading text-[10px] font-semibold text-[#B3E61D]"
                      >
                        {activeStep === 0
                          ? "uploading"
                          : activeStep === 1
                            ? "processing"
                            : "ready"}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="space-y-2">
                  {workflow.map((item, index) => {
                    const Icon = item.icon;

                    const state =
                      index < activeStep
                        ? "done"
                        : index === activeStep
                          ? "active"
                          : "waiting";

                    return (
                      <motion.div
                        key={item.title}
                        animate={
                          state === "active"
                            ? {
                                borderColor:
                                  "rgba(179,230,29,.20)",
                                backgroundColor:
                                  "rgba(179,230,29,.05)",
                                y: -1,
                              }
                            : {
                                borderColor:
                                  "rgba(255,255,255,.06)",
                                backgroundColor:
                                  "rgba(255,255,255,.022)",
                                y: 0,
                              }
                        }
                        transition={{
                          duration: 0.35,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
                      >
                        {/* workflow icon */}
                        <motion.div
                          animate={
                            state === "active" &&
                            !reducedMotion
                              ? {
                                  scale: [
                                    1,
                                    1.06,
                                    1,
                                  ],
                                }
                              : {
                                  scale: 1,
                                }
                          }
                          transition={{
                            duration: 1.4,
                            repeat:
                              state === "active" &&
                              !reducedMotion
                                ? Infinity
                                : 0,
                            ease: "easeInOut",
                          }}
                          className={`relative flex size-6 shrink-0 items-center justify-center rounded-md border ${
                            state === "done"
                              ? "border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-400"
                              : state === "active"
                                ? "border-[#B3E61D]/20 bg-[#B3E61D]/10 text-[#B3E61D]"
                                : "border-white/[0.07] bg-white/[0.015] text-white/25"
                          }`}
                        >
                          <AnimatePresence
                            mode="wait"
                            initial={false}
                          >
                            {state === "done" ? (
                              <motion.div
                                key="complete"
                                initial={{
                                  opacity: 0,
                                  scale: 0.6,
                                  rotate: -15,
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                  rotate: 0,
                                }}
                                exit={{
                                  opacity: 0,
                                  scale: 0.7,
                                }}
                                transition={{
                                  type: "spring",
                                  stiffness: 300,
                                  damping: 20,
                                }}
                              >
                                <Check className="size-3" />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="icon"
                                initial={{
                                  opacity: 0,
                                  scale: 0.8,
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                }}
                              >
                                <Icon
                                  className={`size-3 ${
                                    item.title ===
                                      "Transcoding video" &&
                                    state === "active" &&
                                    !reducedMotion
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        {/* content */}
                        <div className="min-w-0">
                          <p
                            className={`font-heading truncate text-xs font-semibold transition-colors ${
                              state === "active"
                                ? "text-white/90"
                                : state === "done"
                                  ? "text-white/60"
                                  : "text-white/32"
                            }`}
                          >
                            {item.title}
                          </p>

                          <p className="font-subheading mt-0.5 truncate text-[10px] text-white/25">
                            {item.description}
                          </p>
                        </div>

                        {/* state */}
                        <div className="ml-auto flex size-4 shrink-0 items-center justify-center">
                          <AnimatePresence
                            mode="wait"
                            initial={false}
                          >
                            {state === "done" && (
                              <motion.div
                                key="done"
                                initial={{
                                  opacity: 0,
                                  scale: 0.7,
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                }}
                                exit={{
                                  opacity: 0,
                                  scale: 0.7,
                                }}
                              >
                                <CheckCircle2 className="size-3 text-emerald-400" />
                              </motion.div>
                            )}

                            {state === "active" && (
                              <motion.div
                                key="active"
                                initial={{
                                  opacity: 0,
                                  scale: 0.7,
                                }}
                                animate={
                                  reducedMotion
                                    ? {
                                        opacity: 1,
                                        scale: 1,
                                      }
                                    : {
                                        opacity: [
                                          0.35,
                                          1,
                                          0.35,
                                        ],
                                        scale: [
                                          0.92,
                                          1.07,
                                          0.92,
                                        ],
                                      }
                                }
                                exit={{
                                  opacity: 0,
                                  scale: 0.7,
                                }}
                                transition={{
                                  duration: 1.2,
                                  repeat: reducedMotion
                                    ? 0
                                    : Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                <Radio className="size-3 text-[#B3E61D]" />
                              </motion.div>
                            )}

                            {state === "waiting" && (
                              <motion.div
                                key="waiting"
                                initial={{
                                  opacity: 0,
                                  x: -2,
                                }}
                                animate={{
                                  opacity: 1,
                                  x: 0,
                                }}
                                exit={{
                                  opacity: 0,
                                  x: 2,
                                }}
                              >
                                <ArrowRight className="size-3 text-white/15" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* editor status bar */}
            <div className="font-subheading flex h-6 items-center border-t border-white/[0.06] bg-black/20 px-3 text-[10px] text-white/20">
              <span>main*</span>

              <div className="ml-auto flex items-center gap-3">
                <span>TypeScript</span>
                <span>Prettier</span>
              </div>
            </div>
          </div>

          {/* API response */}
          <motion.div
            layout
            className="relative z-20 mx-auto -mt-2.5 flex w-[90%] items-center justify-between overflow-hidden rounded-xl border border-border/70 bg-background px-3 py-2.5 shadow-[0_14px_32px_-18px_rgba(0,0,0,.30)]"
          >
            {/* progress wash */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 bg-[#B3E61D]/[0.045]"
              animate={{
                width:
                  activeStep === 0
                    ? "25%"
                    : activeStep === 1
                      ? "62%"
                      : "100%",
              }}
              transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
            />

            <div className="relative flex min-w-0 items-center gap-2.5">
              <motion.div
                animate={{
                  backgroundColor:
                    activeStep === 2
                      ? "rgba(16,185,129,.10)"
                      : activeStep === 1
                        ? "rgba(179,230,29,.10)"
                        : "rgba(148,163,184,.09)",
                }}
                transition={{
                  duration: 0.3,
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg"
              >
                <AnimatePresence
                  mode="wait"
                  initial={false}
                >
                  {activeStep === 0 && (
                    <motion.div
                      key="upload"
                      initial={{
                        opacity: 0,
                        scale: 0.7,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.7,
                      }}
                    >
                      <UploadCloud className="size-3.5 text-muted-foreground" />
                    </motion.div>
                  )}

                  {activeStep === 1 && (
                    <motion.div
                      key="processing"
                      initial={{
                        opacity: 0,
                        scale: 0.7,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.7,
                      }}
                    >
                      <LoaderCircle
                        className={`size-3.5 text-[#7a9917] ${
                          !reducedMotion
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                    </motion.div>
                  )}

                  {activeStep === 2 && (
                    <motion.div
                      key="ready"
                      initial={{
                        opacity: 0,
                        scale: 0.65,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.7,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 280,
                        damping: 18,
                      }}
                    >
                      <FileVideo2 className="size-3.5 text-emerald-600" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <div className="min-w-0">
                <AnimatePresence
                  mode="wait"
                  initial={false}
                >
                  <motion.div
                    key={activeStep}
                    initial={{
                      opacity: 0,
                      y: 3,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    exit={{
                      opacity: 0,
                      y: -3,
                    }}
                    transition={{
                      duration: 0.2,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <p className="font-heading truncate text-xs font-semibold text-foreground">
                        {activeStep === 0
                          ? "Upload accepted"
                          : activeStep === 1
                            ? "Generating renditions"
                            : "Video ready"}
                      </p>

                      {activeStep === 2 && (
                        <CheckCircle2 className="size-3 text-emerald-500" />
                      )}
                    </div>

                    <p className="font-subheading mt-0.5 truncate text-[11px] text-muted-foreground">
                      {activeStep === 0
                        ? "upload_7Jk2mP · 24.8 MB"
                        : activeStep === 1
                          ? "360p · 720p · 1080p · 4K"
                          : "manifest.m3u8 · 6 renditions"}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.div
                key={activeStep}
                initial={{
                  opacity: 0,
                  scale: 0.9,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.9,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="relative shrink-0"
              >
                <span
                  className={`font-subheading rounded-md px-2 py-1 text-[11px] font-semibold ${
                    activeStep === 2
                      ? "bg-emerald-500/10 text-emerald-600"
                      : activeStep === 1
                        ? "bg-[#B3E61D]/15 text-[#708c16]"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {activeStep === 0
                    ? "202"
                    : activeStep === 1
                      ? "processing"
                      : "201"}
                </span>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
        <CardBottomFade height="h-20" />
        

      </div>
    </BentoCard>
  );
}

function CodeLine({
  number,
  active,
  children,
}: {
  number: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-[19px] items-center">
      {/* moving editor line highlight */}
      {active && (
        <motion.div
          layoutId="active-code-line"
          className="absolute -left-11 -right-3 inset-y-0 border-l-2 border-[#B3E61D]/60 bg-[#B3E61D]/[0.035]"
          transition={{
            type: "spring",
            stiffness: 230,
            damping: 28,
          }}
        />
      )}

      <span
        className={`font-subheading absolute -left-8 z-10 w-4 select-none text-right text-[10px] transition-colors duration-300 ${
          active
            ? "text-[#B3E61D]/65"
            : "text-white/15"
        }`}
      >
        {number}
      </span>

      <div className="relative z-10 whitespace-nowrap">
        {children}

        {active && (
          <motion.span
            className="ml-1 inline-block h-3 w-[1.5px] translate-y-[2px] bg-[#B3E61D]"
            animate={{
              opacity: [1, 1, 0, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              times: [0, 0.48, 0.5, 1],
            }}
          />
        )}
      </div>
    </div>
  );
}