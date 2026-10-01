"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Check,
  Globe2,
  Image as ImageIcon,
  MessageSquare,
  Repeat2,
  Send,
  ThumbsUp,
  Type as TypeIcon,
} from "lucide-react";
import { Linkedin } from "@/lib/icons";

/* ============================================================
   Brand
============================================================ */

const BRAND = "#128be0";

const BRAND_FIELD =
  "linear-gradient(180deg, #36a7f3 0%, #2199ec 44%, #128be0 100%)";

/** Every card is the same height, so the stack positions are exact. */
const CARD_HEIGHT = 180;
const CARD_GAP = 16;
const CARD_STEP = CARD_HEIGHT + CARD_GAP;

const TYPE_SPEED = 26;
const PAUSE_BEFORE_PUBLISH = 900;
const PAUSE_AFTER_PUBLISH = 1800;

/* ============================================================
   Content
============================================================ */

interface FeedPost {
  id: string;
  author: string;
  initials: string;
  role: string;
  body: string;
  reactions: number;
  comments: number;
  mine?: boolean;
}

/** Posts already in the feed. They drain out as yours go live. */
const baseFeed: FeedPost[] = [
  {
    id: "base-1",
    author: "Priya Raghunathan",
    initials: "PR",
    role: "Head of Growth at Lumen",
    body: "Rewrote our worst-performing post with one change: I cut the first two lines. It did six times the reach.",
    reactions: 143,
    comments: 21,
  },
  {
    id: "base-2",
    author: "Marcus Doyle",
    initials: "MD",
    role: "Founder at Rendlo",
    body: "Your first hundred followers come from replying, not posting. Nobody tells you this part.",
    reactions: 88,
    comments: 11,
  },
  {
    id: "base-3",
    author: "Elena Fischer",
    initials: "EF",
    role: "B2B Content Lead",
    body: "Everyone wants the reach. Almost nobody wants to answer comments for an hour after it lands.",
    reactions: 167,
    comments: 34,
  },
  {
    id: "base-4",
    author: "Tomas Nowak",
    initials: "TN",
    role: "Sales Director at Arcwell",
    body: "I stopped writing for the algorithm and started writing for six people I actually wanted to hear from.",
    reactions: 122,
    comments: 17,
  },
];

/** Drafts the composer writes, in order. Each one goes live into the feed. */
const drafts = [
  {
    id: "draft-1",
    body: "Consistency beats frequency. We cut our posting in half and impressions went up.",
    reactions: 128,
    comments: 19,
  },
  {
    id: "draft-2",
    body: "Your profile is a landing page. Most people still treat it like a résumé.",
    reactions: 96,
    comments: 14,
  },
  {
    id: "draft-3",
    body: "The best hook I wrote this year was a line I almost deleted.",
    reactions: 211,
    comments: 28,
  },
  {
    id: "draft-4",
    body: "Nobody replies to a pitch. Everybody replies to a good question.",
    reactions: 154,
    comments: 22,
  },
  {
    id: "draft-5",
    body: "Three months of showing up beat a year of cold email. I have the numbers.",
    reactions: 187,
    comments: 31,
  },
];

const VISIBLE_CARDS = 4;

/* ============================================================
   Panel
============================================================ */

export default function AuthVisualPanel() {
  const reducedMotion = useReducedMotion();

  const [draftIndex, setDraftIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [scheduled, setScheduled] = useState(false);
  const [feed, setFeed] = useState<FeedPost[]>(baseFeed);

  const draft = drafts[draftIndex];
  const isTyping = typed < draft.body.length;

  /* -- Typing, then a beat before it goes out --------------------------- */

  useEffect(() => {
    if (reducedMotion) return;

    if (typed < draft.body.length) {
      const timer = window.setTimeout(
        () => setTyped((count) => count + 1),
        TYPE_SPEED,
      );

      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(
      () => setScheduled(true),
      PAUSE_BEFORE_PUBLISH,
    );

    return () => window.clearTimeout(timer);
  }, [typed, draft.body.length, reducedMotion]);

  /* -- The post enters the feed and pushes the rest down ----------------- */

  useEffect(() => {
    if (!scheduled || reducedMotion) return;

    setFeed((previous) =>
      [
        {
          id: `${draft.id}-${draftIndex}`,
          author: "Ajay Singh",
          initials: "AS",
          role: "Founder at Outlify",
          body: draft.body,
          reactions: draft.reactions,
          comments: draft.comments,
          mine: true,
        },
        ...previous,
      ].slice(0, VISIBLE_CARDS),
    );

    const timer = window.setTimeout(() => {
      setScheduled(false);
      setTyped(0);
      setDraftIndex((index) => (index + 1) % drafts.length);
    }, PAUSE_AFTER_PUBLISH);

    return () => window.clearTimeout(timer);
  }, [scheduled, draft, draftIndex, reducedMotion]);

  /* -- No motion: show the finished state -------------------------------- */

  useEffect(() => {
    if (reducedMotion) setTyped(drafts[0].body.length);
  }, [reducedMotion]);

  return (
    <section
      className="relative hidden min-h-screen w-full overflow-hidden md:flex md:flex-col"
      style={{ background: BRAND_FIELD }}
    >
      {/* Light falling from the top right, so the field isn't flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 "
        style={{
          background:
            "radial-gradient(120% 80% at 88% -10%, #FFFFFF86 0%, rgba(255,255,255,0) 60%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col px-8 py-10 lg:px-12 xl:px-16">
        {/* ===============================
            Brand
        =============================== */}

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm">
            <Linkedin size={19} />
          </div>

          <div>
            <p className="font-heading text-lg font-semibold tracking-[-0.02em] text-white">
              Outlify
            </p>

            <p className="text-[15px] text-white/75">
              LinkedIn content and outreach
            </p>
          </div>
        </div>

        {/* ===============================
            Stage
        =============================== */}

        <div
          aria-hidden
          className="relative my-10 min-h-0 flex-1 overflow-hidden"
        >
          {/* The feed wall, tilted and running off the edge */}
          <div
            className="absolute right-[-16%] top-[-4%] w-[430px] origin-top"
            style={{ transform: "rotate(-8deg)" }}
          >
            <AnimatePresence initial={false}>
              {feed.map((post, index) => (
                <motion.div
                  key={post.id}
                  className="absolute inset-x-0 top-0"
                  initial={
                    reducedMotion
                      ? false
                      : { y: -CARD_STEP * 0.6, opacity: 0, scale: 0.94 }
                  }
                  animate={{
                    y: index * CARD_STEP,
                    opacity: 1 - index * 0.08,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{
                    type: "spring",
                    stiffness: 210,
                    damping: 26,
                    opacity: { duration: 0.35 },
                  }}
                >
                  <FeedCard
                    post={post}
                    countUp={Boolean(post.mine) && index === 0 && !reducedMotion}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Keeps the headline sitting on clean colour */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5"
            style={{
              background:
                "linear-gradient(to top, #128be0 0%, rgba(18,139,224,0.85) 45%, rgba(18,139,224,0) 100%)",
            }}
          />

          {/* The composer, upright and in front */}
          <div className="absolute left-0 top-1/2 z-20 w-full max-w-[400px] -translate-y-1/2">
            <Composer
              body={draft.body.slice(0, typed)}
              isTyping={isTyping && !reducedMotion}
              scheduled={scheduled}
            />
          </div>
        </div>

        {/* ===============================
            Typography
        =============================== */}

        <div className="shrink-0">
          <h2 className="font-heading max-w-[560px] text-[42px] font-medium leading-[1.08] tracking-[-0.04em] text-white xl:text-[50px]">
            Post every week without writing every day.
          </h2>

          <p className="mt-5 max-w-[520px] text-[17px] leading-7 text-white/80">
            Outlify drafts in your voice, schedules around your audience, and
            keeps the replies moving after a post lands.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Composer
============================================================ */

function Composer({
  body,
  isTyping,
  scheduled,
}: {
  body: string;
  isTyping: boolean;
  scheduled: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_28px_70px_-18px_rgba(8,60,105,0.55)]">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: BRAND_FIELD }}
        >
          AS
        </span>

        <div className="min-w-0">
          <p className="font-subheading text-[15px] font-semibold text-slate-900">
            Ajay Singh
          </p>

          <p className="truncate text-sm text-slate-500">
            Founder at Outlify
          </p>
        </div>
      </div>

      <div className="min-h-[92px] px-5 pt-4">
        <p className="text-[15px] leading-7 text-slate-800">
          {body}

          {isTyping && (
            <motion.span
              className="ml-0.5 inline-block h-[18px] w-[2px] translate-y-[3px] rounded-full"
              style={{ backgroundColor: BRAND }}
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
            />
          )}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <ComposerTool icon={TypeIcon} />
          <ComposerTool icon={ImageIcon} />
          <ComposerTool icon={BarChart3} />
        </div>

        <div className="relative h-9 min-w-[150px]">
          <AnimatePresence initial={false} mode="wait">
            {scheduled ? (
              <motion.div
                key="scheduled"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 flex items-center justify-end gap-2"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check size={13} strokeWidth={3} />
                </span>

                <span className="font-subheading text-sm font-medium text-slate-700">
                  Scheduled, Tue 8:30
                </span>
              </motion.div>
            ) : (
              <motion.button
                key="schedule"
                type="button"
                tabIndex={-1}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className="font-subheading absolute inset-0 rounded-lg text-sm font-medium text-white"
                style={{ background: BRAND_FIELD }}
              >
                Schedule post
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ComposerTool({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400">
      <Icon size={16} />
    </span>
  );
}

/* ============================================================
   Feed card
============================================================ */

function FeedCard({ post, countUp }: { post: FeedPost; countUp: boolean }) {
  const reactions = useCountUp(post.reactions, countUp);

  return (
    <article
      className="rounded-2xl bg-white px-5 py-5 shadow-[0_18px_44px_-16px_rgba(8,60,105,0.45)]"
      style={{ height: CARD_HEIGHT }}
    >
      <div className="flex items-center gap-3">
        <span
          className={
            post.mine
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600"
          }
          style={post.mine ? { background: BRAND_FIELD } : undefined}
        >
          {post.initials}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-subheading truncate text-[15px] font-semibold text-slate-900">
            {post.author}
          </p>

          <p className="truncate text-sm text-slate-500">{post.role}</p>
        </div>

        <Globe2 size={14} className="shrink-0 text-slate-300" />
      </div>

      <p className="mt-4 line-clamp-2 h-12 text-[15px] leading-6 text-slate-700">
        {post.body}
      </p>

      <div className="mt-4 flex items-center gap-5 text-sm text-slate-500">
        <span className="flex items-center gap-1.5">
          <ThumbsUp size={14} />
          <span className="tabular-nums">{reactions}</span>
        </span>

        <span className="flex items-center gap-1.5">
          <MessageSquare size={14} />
          <span className="tabular-nums">{post.comments}</span>
        </span>

        <Repeat2 size={14} className="ml-auto text-slate-300" />
        <Send size={14} className="text-slate-300" />
      </div>
    </article>
  );
}

/* ============================================================
   Count up
============================================================ */

function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(run ? 0 : target);

  useEffect(() => {
    if (!run) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 1100;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(Math.round(target * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [target, run]);

  return value;
}