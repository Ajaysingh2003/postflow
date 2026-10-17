"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  Fingerprint,
  MessageSquareText,
  PenLine,
  RefreshCw,
  Repeat2,
  Sparkles,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { refinementChanges } from "@/modules/content/studio/refinement";

/* -------------------------------------------------------------------------- */
/*  Demo content                                                              */
/* -------------------------------------------------------------------------- */

const ORIGINAL =
  "we shipped our new editor today. spent 3 weeks on the small things and it finally feels right";

const REFINEMENTS = {
  improve: {
    label: "Improve writing",
    versions: [
      "We shipped our new editor today. Three weeks spent on the small details, and it finally feels right.",
      "Our new editor is live. We spent three weeks getting the small details right. Today, it all came together.",
    ],
  },
  shorter: {
    label: "Make shorter",
    versions: [
      "Our new editor is live. Three weeks of small details. A much better writing experience.",
      "Three weeks of little improvements. One editor that finally feels right. Shipped today.",
    ],
  },
  hook: {
    label: "Stronger hook",
    versions: [
      "The small details took three weeks. They made all the difference. Our new editor is live today.",
      "We rebuilt the part of our product you spend the most time in. Our new editor is live, three weeks of small improvements later.",
    ],
  },
};
type Refinement = keyof typeof REFINEMENTS;

const SUGGESTIONS = [
  {
    prompt: "Make it more personal",
    text: "We shipped our new editor today.\n\nI thought the hard part would be building it. Turns out, it was knowing when the small details were good enough.\n\nThree weeks later, it finally feels like something I’d want to write in.",
    note: "A little more of the story behind the launch. Still your point of view.",
  },
  {
    prompt: "Give it a tighter opening",
    text: "Three weeks on the details you might never notice.\n\nA calmer toolbar. A better way to refine a sentence. Fewer interruptions while you write.\n\nOur new editor is live today. Try it and tell us what feels different.",
    note: "Leads with the work, then gives readers a reason to try it.",
  },
];

const VOICES = {
  personal: {
    name: "Personal",
    rules: ["First person", "Honest details", "No buzzwords"],
    sample:
      "I nearly called it done a week ago. Then I used it to write a real post. A few things still got in the way. So we fixed them.",
    result:
      "I spent three weeks making our editor feel less like a tool and more like a place to think. It’s live today. I’d love to know how it feels to you.",
  },
  concise: {
    name: "Concise",
    rules: ["Short sentences", "Lead with the news", "Every word earns its place"],
    sample: "Fewer clicks. Less clutter. More room to write. That was the brief.",
    result:
      "Our new editor is live. Three weeks of small improvements. A cleaner space to write, refine, and hit publish.",
  },
  thoughtful: {
    name: "Thoughtful",
    rules: ["Explain the why", "Concrete observations", "Calm, conversational tone"],
    sample:
      "Good writing tools leave you alone until you need them. We kept coming back to that while building this.",
    result:
      "The best change we made to our editor wasn’t adding a feature. It was getting the tools out of the way. After three weeks of small decisions, the new version is ready.",
  },
};
type VoiceId = keyof typeof VOICES;

const CHANNELS = {
  x: {
    name: "X",
    mark: "𝕏",
    limit: 280,
    format: "Short and direct",
    text: "Three weeks on the small details.\n\nA calmer toolbar. Easier rewrites. More room to think.\n\nOur new editor is live today. What’s one thing that always breaks your writing flow?",
  },
  linkedin: {
    name: "LinkedIn",
    mark: "in",
    limit: 3000,
    format: "A story with a takeaway",
    text: "We spent three weeks on the details of our new editor.\n\nNot a big new feature. The small things: where a button sits, how a rewrite feels, what happens when you lose your train of thought.\n\nThe lesson? A better writing experience often comes from removing friction.\n\nThe new editor is live today. I’d love your feedback.",
  },
  threads: {
    name: "Threads",
    mark: "@",
    limit: 500,
    format: "Start a conversation",
    text: "Our new editor is finally out in the world. We spent three weeks moving buttons, rewriting labels, and asking “does this actually make writing easier?”\n\nCurious: what’s the smallest detail in an app that makes a big difference to you?",
  },
};
type ChannelId = keyof typeof CHANNELS;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function useBriefDelay(ms = 600) {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (action: () => void) => {
    clearTimeout(timer.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      action();
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => {
      action();
      setPending(false);
    }, ms);
  };

  return { pending, run };
}

function SkeletonLines({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2 py-1", className)}>
      <div className="h-3 w-full animate-pulse rounded bg-black/[0.06] motion-reduce:animate-none" />
      <div className="h-3 w-11/12 animate-pulse rounded bg-black/[0.06] motion-reduce:animate-none" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-black/[0.06] motion-reduce:animate-none" />
    </div>
  );
}

function DiffText({ from, to }: { from: string; to: string }) {
  return (
    <>
      {refinementChanges(from, to).map((part, index) =>
        part.added ? (
          <mark key={index} className="rounded-[3px] bg-[#d5f4d7] py-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Kbd({ children, onPrimary }: { children: ReactNode; onPrimary?: boolean }) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "hidden rounded px-1 font-subheading text-[10px] leading-4 sm:inline",
        onPrimary ? "bg-white/20 text-white" : "bg-black/[0.06] text-[#6d7066]",
      )}
    >
      {children}
    </kbd>
  );
}

function StackedPanels({
  active,
  panels,
}: {
  active: string;
  panels: { id: string; node: ReactNode }[];
}) {
  return (
    <div role="tabpanel" className="grid">
      {panels.map((panel) => (
        <div
          key={panel.id}
          className={cn("col-start-1 row-start-1", panel.id !== active && "invisible")}
        >
          {panel.node}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Layout pieces                                                             */
/* -------------------------------------------------------------------------- */

function ShowcaseRow({
  icon: Icon,
  badge,
  title,
  description,
  points,
  flipped,
  children,
}: {
  icon: LucideIcon;
  badge: string;
  title: string;
  description: string;
  points: string[];
  flipped?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-16"
      aria-label={badge}
    >
      <div className={cn("lg:col-span-5", flipped && "lg:order-2")}>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#3fda8a]/40 bg-[#3fda8a]/15 px-3 py-1 font-subheading text-xs font-semibold text-[#0f7a47]">
          <Icon className="size-3.5" aria-hidden="true" />
          {badge}
        </span>
        <h2 className="font-heading mt-4 text-balance text-3xl font-semibold tracking-tight text-[#11120e] sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#6d7066]">{description}</p>
        <ul className="mt-6 space-y-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 text-sm leading-relaxed text-[#11120e]"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#3fda8a]/20 text-[#0f7a47]">
                <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn("min-w-0 lg:col-span-7", flipped && "lg:order-1")}>{children}</div>
    </section>
  );
}

function DemoWindow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-black/[0.08] bg-white text-[#11120e] shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] bg-[#faf9f5] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-neutral-300" />
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-neutral-300" />
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-neutral-300" />
          <span className="ml-2 truncate font-subheading text-xs text-[#85887e]">
            draftva / {label}
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-subheading text-[10px] text-[#0f7a47] sm:text-[11px]">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-[#3fda8a] motion-safe:animate-pulse"
          />
          Try it
        </span>
      </div>
      {children}
    </div>
  );
}

function DemoAuthor({ channel = "@alexbuilds" }: { channel?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8 border border-black/5 sm:size-9">
        <AvatarFallback className="bg-[#f0ede6] text-xs font-semibold text-[#736b5a]">
          AM
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-xs">
        <p className="font-semibold">Alex Morgan</p>
        <p className="mt-0.5 truncate text-[11px] text-[#85887e]">{channel}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Demo 1: inline refinement                                                  */
/* -------------------------------------------------------------------------- */

function InlineRefineDemo() {
  const [command, setCommand] = useState<Refinement>("improve");
  const [version, setVersion] = useState(0);
  const [applied, setApplied] = useState(false);
  const { pending, run } = useBriefDelay();

  const suggestion = REFINEMENTS[command].versions[version];
  const draft = applied ? suggestion : ORIGINAL;

  const choose = (key: Refinement) =>
    run(() => {
      setCommand(key);
      setVersion(0);
      setApplied(false);
    });

  const retry = () =>
    run(() => {
      setVersion((v) => (v + 1) % REFINEMENTS[command].versions.length);
      setApplied(false);
    });

  return (
    <DemoWindow label="refine your draft">
      <div className="p-4 sm:p-6">
        <DemoAuthor />

        <p
          aria-live="polite"
          className="mt-3 text-xs leading-6 sm:text-sm sm:leading-7"
        >
          {applied ? <DiffText from={ORIGINAL} to={suggestion} /> : ORIGINAL}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
          <span className="text-[11px] tabular-nums text-[#85887e]">{draft.length} / 280</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-[#0f7a47] hover:bg-[#3fda8a]/10 hover:text-[#0f7a47]"
                />
              }
            >
              <Sparkles className="size-3.5" />
              {REFINEMENTS[command].label}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(REFINEMENTS) as Refinement[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => choose(key)}>
                  {REFINEMENTS[key].label}
                  {key === command && <Check className="ml-auto size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3.5 rounded-2xl border border-black/[0.08] bg-white p-3.5 shadow-sm sm:p-4">
          <p className="flex items-center gap-2 text-xs text-[#85887e]">
            <Sparkles className="size-3.5 text-[#db51fd]" aria-hidden="true" />
            {REFINEMENTS[command].label}
          </p>

          <div className="mt-2 text-xs leading-6 sm:text-sm sm:leading-7" aria-live="polite">
            {pending ? <SkeletonLines /> : <DiffText from={ORIGINAL} to={suggestion} />}
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                style={{backgroundColor:"violet"!}}
                disabled={pending}
                className="primary-btn  rounded-xl"
                onClick={() => setApplied(!applied)}
              >
                {applied ? (
                  <>
                    <Undo2 className="size-3.5" />
                    Undo
                  </>
                ) : (
                  <>
                    Replace
                    <Kbd onPrimary>⌘↵</Kbd>
                    <ArrowRight className="size-3.5 sm:hidden" />
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="secondary-btn rounded-xl"
                onClick={retry}
              >
                <RefreshCw
                  className={cn("size-3.5", pending && "motion-safe:animate-spin")}
                />
                Retry
                <Kbd>R</Kbd>
              </Button>
            </div>
            <span role="status" className="text-[11px] text-[#85887e]">
              {pending
                ? "Rewriting…"
                : applied
                  ? "Replaced in draft"
                  : `${ORIGINAL.length} → ${suggestion.length} chars`}
            </span>
          </div>
        </div>
      </div>
    </DemoWindow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Demo 2: assistant                                                         */
/* -------------------------------------------------------------------------- */

function AssistantDemo() {
  const [selected, setSelected] = useState(0);
  const [shown, setShown] = useState(0);
  const [compare, setCompare] = useState(true);
  const [applied, setApplied] = useState(false);
  const { pending, run } = useBriefDelay();

  const suggestion = SUGGESTIONS[shown];

  const pick = (index: number) => {
    if (index === selected) return;
    setSelected(index);
    setApplied(false);
    run(() => setShown(index));
  };

  return (
    <DemoWindow label="your writing assistant">
      <div className="border-b border-black/[0.06] p-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <DemoAuthor />
          <span
            role="status"
            className="flex items-center gap-1 text-[10px] text-[#0f7a47]"
          >
            {applied ? (
              <>
                <CheckCheck className="size-3.5" />
                Applied to draft
              </>
            ) : (
              <span className="text-[#85887e]">Your draft</span>
            )}
          </span>
        </div>
        <p className="mt-2.5 text-xs leading-6 sm:text-sm" aria-live="polite">
          {applied ? suggestion.text : ORIGINAL}
        </p>
      </div>

      <div className="bg-[#fafaf9] p-4 sm:p-6">
        <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold">
          <MessageSquareText className="size-4 text-[#0f7a47]" aria-hidden="true" />
          Assistant
        </div>

        <p className="ml-6 rounded-xl rounded-br-sm bg-[#eeefed] px-3 py-2 text-xs leading-relaxed sm:ml-8">
          {SUGGESTIONS[selected].prompt}
        </p>

        <div className="mt-3 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm">
          <p className="border-b border-black/[0.06] px-4 py-2.5 font-heading text-xs font-semibold sm:text-sm">
            Suggested draft
          </p>

          <div aria-live="polite" className="space-y-2 p-3 text-xs leading-6 sm:p-4 sm:text-sm">
            {pending ? (
              <SkeletonLines />
            ) : (
              <>
                {compare && (
                  <p className="rounded-lg bg-[#fff1f3] px-2.5 py-1.5 text-xs text-[#a83c55]">
                    <span aria-hidden="true">− </span>
                    {ORIGINAL}
                  </p>
                )}
                <p
                  className={cn(
                    "rounded-lg p-2.5 text-xs sm:text-sm",
                    compare && "bg-[#eefbf4] text-[#24664a]",
                  )}
                >
                  {compare && <span aria-hidden="true">+ </span>}
                  {suggestion.text}
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] px-3.5 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg px-2 text-xs text-[#6d7066]"
              aria-pressed={compare}
              onClick={() => setCompare(!compare)}
            >
              ± Compare
            </Button>
            <Button
              size="sm"
              disabled={pending}
              className={cn(applied ? "secondary-btn" : "primary-btn", "h-8 rounded-lg px-3 text-xs")}
              onClick={() => setApplied(!applied)}
            >
              {applied ? (
                <>
                  <Undo2 className="size-3.5" />
                  Undo
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  Apply
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="mt-2.5 min-h-7 text-[11px] leading-5 text-[#85887e]">
          {pending ? "Thinking…" : suggestion.note}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2" role="group" aria-label="Example assistant prompts">
          {SUGGESTIONS.map((item, index) => (
            <Button
              key={item.prompt}
              variant="outline"
              size="sm"
              aria-pressed={selected === index}
              className={cn(
                "h-auto rounded-xl border-black/10 bg-white px-2.5 py-1.5 text-[11px]",
                selected === index && "border-[#3fda8a]/60 bg-[#3fda8a]/15 text-[#0f7a47]",
              )}
              onClick={() => pick(index)}
            >
              {item.prompt}
            </Button>
          ))}
        </div>
      </div>
    </DemoWindow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Demo 3: brand voice                                                       */
/* -------------------------------------------------------------------------- */

function BrandVoiceDemo() {
  const [voice, setVoice] = useState<VoiceId>("personal");

  return (
    <DemoWindow label="your brand voice">
      <Tabs
        value={voice}
        onValueChange={(value) => setVoice(value as VoiceId)}
        className="flex-col gap-0"
      >
        <div className="mx-4 mt-4 overflow-x-auto sm:mx-6 sm:mt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList
            aria-label="Example writing voices"
            className="h-9 w-full justify-start rounded-xl bg-[#f2f1ed] p-1 sm:w-auto"
          >
            {(Object.keys(VOICES) as VoiceId[]).map((id) => {
              const isActive = voice === id;
              return (
                <TabsTrigger
                  key={id}
                  value={id}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1 font-subheading text-xs font-medium transition-all sm:flex-initial sm:px-4",
                    "data-[state=active]:bg-white data-[state=active]:text-[#11120e] data-[state=active]:shadow-sm",
                    isActive
                      ? "bg-white text-[#11120e] shadow-sm"
                      : "bg-transparent text-[#6d7066] hover:text-[#11120e]",
                  )}
                >
                  {VOICES[id].name}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="p-4 sm:p-6">
          <StackedPanels
            active={voice}
            panels={(Object.keys(VOICES) as VoiceId[]).map((id) => ({
              id,
              node: (
                <div className="space-y-3.5 sm:space-y-4" aria-live={id === voice ? "polite" : undefined}>
                  <div className="rounded-2xl border border-black/[0.06] bg-[#faf9f5] p-4">
                    <p className="flex items-center gap-2 text-xs font-medium text-[#85887e]">
                      <Fingerprint className="size-3.5 shrink-0" aria-hidden="true" />
                      A sample of your writing
                    </p>
                    <blockquote className="mt-2.5 text-xs leading-6 text-[#55594f] sm:text-sm sm:leading-7">
                      “{VOICES[id].sample}”
                    </blockquote>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {VOICES[id].rules.map((rule) => (
                        <span
                          key={rule}
                          className="rounded-md border border-black/[0.06] bg-white px-2 py-0.5 text-[10px] text-[#6d7066]"
                        >
                          {rule}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-[11px] text-[#85887e]">
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                    New idea: announce the new editor
                  </div>

                  <div className="rounded-2xl border border-[#3fda8a]/30 bg-[#f6fcf8] p-4">
                    <DemoAuthor />
                    <p className="mt-3 text-xs leading-6 sm:text-sm sm:leading-7">{VOICES[id].result}</p>
                    <p className="mt-3 flex items-center gap-1.5 border-t border-[#3fda8a]/20 pt-2.5 text-[11px] text-[#0f7a47]">
                      <CheckCheck className="size-3.5 shrink-0" aria-hidden="true" />
                      Written in your {VOICES[id].name.toLowerCase()} voice
                    </p>
                  </div>
                </div>
              ),
            }))}
          />
        </div>
      </Tabs>
    </DemoWindow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Demo 4: adapt per channel                                                 */
/* -------------------------------------------------------------------------- */

function AdaptDemo() {
  const [channel, setChannel] = useState<ChannelId>("x");

  return (
    <DemoWindow label="adapt for each channel">
      <div className="border-b border-black/[0.06] bg-[#fafaf9] px-4 py-3.5 sm:px-6">
        <p className="text-xs font-medium text-[#85887e]">The original idea</p>
        <p className="mt-1.5 text-xs leading-5 text-[#55594f]">
          New editor launch. Three weeks on the small details. Ask people what makes writing
          easier.
        </p>
      </div>

      <Tabs
        value={channel}
        onValueChange={(value) => setChannel(value as ChannelId)}
        className="flex-col gap-0"
      >
        <div className="mx-4 mt-4 overflow-x-auto sm:mx-6 sm:mt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList
            aria-label="Adapt the example for a channel"
            className="h-9 w-full  justify-start bg-[#f2f1ed] p-1 sm:w-auto"
          >
            {(Object.keys(CHANNELS) as ChannelId[]).map((id) => (
                
              <TabsTrigger
                  key={id}
                  value={id}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1 font-subheading text-xs font-medium transition-all sm:flex-initial sm:px-4",
                    "data-[state=active]:bg-white data-[state=active]:text-[#11120e] data-[state=active]:shadow-sm",
                    channel==id
                      ? "bg-white text-[#11120e] shadow-sm"
                      : "bg-transparent text-[#6d7066] hover:text-[#11120e]",
                  )}
                >
                <span
                  aria-hidden="true"
                  className={cn("font-semibold", id === "linkedin" && "text-[#0A66C2]")}
                >
                  {CHANNELS[id].mark}
                </span>
                {CHANNELS[id].name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="p-4 sm:p-6">
          <StackedPanels
            active={channel}
            panels={(Object.keys(CHANNELS) as ChannelId[]).map((id) => {
              const c = CHANNELS[id];
              return {
                id,
                node: (
                  <div aria-live={id === channel ? "polite" : undefined}>
                    <div className="rounded-2xl border border-black/[0.06] p-4 sm:p-5">
                      <DemoAuthor
                        channel={id === "linkedin" ? "Building in public · Founder" : "@alexbuilds"}
                      />
                      <p className="mt-3 text-xs leading-6 sm:text-sm sm:leading-7">{c.text}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-2.5 text-[10px] text-[#85887e]">
                        <span>{c.format}</span>
                        <span className="shrink-0 tabular-nums">
                          {c.text.length} / {c.limit}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#0f7a47]">
                      <Check className="size-3.5 shrink-0" aria-hidden="true" />
                      Formatted for {c.name}. Ready for your final edit.
                    </p>
                  </div>
                ),
              };
            })}
          />
        </div>
      </Tabs>
    </DemoWindow>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

export default function WriterShowcase() {
  return (
    <div
      id="writer-showcase"
      className="mx-auto w-full max-w-7xl space-y-16  py-8  lg:space-y-28  lg:py-16"
    >
      <ShowcaseRow
        icon={PenLine}
        badge="Inline refinement"
        title="Your thought. Just a little more polished."
        description="Keep writing, even when the words aren’t quite there yet. Refine a sentence or a whole post, see what changed, and keep the version that sounds like you."
        points={[
          "Fix grammar without losing your point of view",
          "Try a sharper hook or a shorter version",
          "Review every change before replacing your draft",
        ]}
      >
        <InlineRefineDemo />
      </ShowcaseRow>

      <ShowcaseRow
        flipped
        icon={MessageSquareText}
        badge="Your writing partner"
        title="Talk it through. Then make it yours."
        description="Sometimes you need more than a rewrite. Give the assistant a direction, compare its suggestion with your draft, and bring the useful parts back into your editor."
        points={[
          "Ask for context, a new angle, or a clearer opening",
          "Compare your original with the suggested draft",
          "Apply a suggestion when you’re happy with it",
        ]}
      >
        <AssistantDemo />
      </ShowcaseRow>

      <ShowcaseRow
        icon={Fingerprint}
        badge="A voice that’s yours"
        title="Sound like yourself. Even on a blank-page day."
        description="Your writing has a rhythm. Give Draftva examples and preferences so the next draft starts closer to your voice, whether that’s thoughtful, conversational, or straight to the point."
        points={[
          "Build a voice profile from your own writing",
          "Keep your tone and the details that matter",
          "Adjust the direction without starting over",
        ]}
      >
        <BrandVoiceDemo />
      </ShowcaseRow>

      <ShowcaseRow
        flipped
        icon={Repeat2}
        badge="One idea, different drafts"
        title="Make the idea fit. Not just the character count."
        description="A good LinkedIn story isn’t always a good X post. Turn the same thought into a focused update, a professional story, or a conversation starter, with room for your final touch."
        points={[
          "Adapt your idea for X, LinkedIn, and Threads",
          "Keep the message while changing the structure",
          "Check each version before it leaves your workspace",
        ]}
      >
        <AdaptDemo />
      </ShowcaseRow>
    </div>
  );
}