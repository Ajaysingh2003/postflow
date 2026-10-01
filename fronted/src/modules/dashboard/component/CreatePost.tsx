/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  GalleryHorizontal,
  Gauge,
  Gift,
  Globe2,
  History,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  PenLine,
  Plus,
  Repeat2,
  Send,
  SlidersHorizontal,
  Smile,
  Sparkles,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Type as TypeIcon,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

const BRAND = "#128be0";

const BRAND_GRADIENT =
  "linear-gradient(180deg, #36a7f3 0%, #2199ec 44%, #128be0 100%)";

/** LinkedIn collapses a post past roughly this many characters. */
const SEE_MORE_LIMIT = 1300;

const MAX_LENGTH = 3000;

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CreatePostProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type LeftTab = "assist" | "drafts" | "media" | "review";
type EditorMode = "edit" | "preview";
type MobilePane = "assistant" | "editor";

type MenuName =
  | "adjust"
  | "history"
  | "commands"
  | "format"
  | "emoji"
  | "schedule"
  | "account";

interface DraftItem {
  id: string;
  title: string;
  content: string;
  savedAt: string;
}

interface PostIdea {
  id: string;
  title: string;
  hook: string;
  fullDraft: string;
  angle: string;
}

/* -------------------------------------------------------------------------- */
/* Seed data                                                                  */
/* -------------------------------------------------------------------------- */

const initialDrafts: DraftItem[] = [
  {
    id: "draft-1",
    title: "The 3 shifts that booked us 42 enterprise demos",
    savedAt: "10 minutes ago",
    content: `Most founders think cold outreach is dead.

They're just doing it like it's 2019.

Here are the 3 shifts that booked us 42 enterprise demos last month, without spamming a single inbox.

1. Build micro-authority first

Before sending a connection request, publish two tactical posts on the exact bottleneck your prospect is living with.

2. Personalise the trigger, not just the name

Don't say: "Saw you're VP at ScaleOps."

Say: "Noticed ScaleOps just expanded the outbound pod to 20 reps."

3. Sell the conversation, not the demo

Nobody wants a 30-minute pitch from a stranger.

Which of these is your biggest bottleneck right now?

#b2bsales #outbound #founders`,
  },
  {
    id: "draft-2",
    title: "What I learned shipping our first AI agent in 2 weeks",
    savedAt: "Yesterday",
    content: `We built and shipped an automated AI agent in 14 days.

Here is what failed, what worked, and what I'd do differently.

What failed: overcomplicating the prompt chain, and building the UI before the workflow was validated.

What worked: solving one specific pain point, and putting it in front of real users on day three.

The biggest takeaway?

Speed isn't about working 80 hours. It's about ruthless prioritisation.

What would you have cut first?

#buildinginpublic #ai #startups`,
  },
  {
    id: "draft-3",
    title: "Why organic reach is the last free distribution channel",
    savedAt: "3 days ago",
    content: `Paid ads get more expensive every quarter.

Cold emails land in spam.

The only channel that still compounds for free is personal authority.

Your profile is your landing page. Treat it like one.

What's working for you right now?`,
  },
];

const presetPostIdeas: PostIdea[] = [
  {
    id: "idea-1",
    title: "Why cold outreach failed in 2026",
    hook: "Cold outreach isn't dead. Lazy outreach is.",
    angle: "Contrarian",
    fullDraft: `Cold outreach isn't dead.

Lazy outreach is.

In 2026, buyers get dozens of generic automated messages every single day.

Here's the new rulebook.

1. Profile-first reputation

Make your profile useful before you send the message.

2. Relevant triggers

Reach out because something actually happened, not because a filter matched.

3. Zero pitch in message one

Aim for a reply, not a closed deal.

Agree or disagree?

#outbound #sales #b2b`,
  },
  {
    id: "idea-2",
    title: "The 3-step founder authority flywheel",
    hook: "You don't need 100,000 followers to close meaningful contracts.",
    angle: "Framework",
    fullDraft: `You don't need 100,000 followers.

You need the right 200 people reading your thinking.

Here's the flywheel that got us there.

1. Share a useful teardown.

2. Show proof of work, including what went wrong.

3. Build relationships with the people who engage.

Quality beats volume. Every single time.

Which step are you skipping?

#growth #leadership #linkedin`,
  },
  {
    id: "idea-3",
    title: "What 100 discovery calls taught us",
    hook: "We ran 100 customer discovery calls. Here's what surprised us most.",
    angle: "Case study",
    fullDraft: `We ran 100 customer discovery calls.

Here's what surprised us most.

Most founders were solving problems their customers didn't care enough about.

Three lessons.

1. Customers don't buy features. They buy outcomes.

2. If pricing never feels uncomfortable, you're undercharging.

3. Your best marketing copy comes straight out of customer calls.

Stop guessing. Start talking to buyers.

What's the last thing a customer said that changed your roadmap?

#startups #customerdiscovery #founders`,
  },
];

const mediaPresets = [
  {
    id: "media-1",
    name: "Pipeline growth",
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "media-2",
    name: "Product dashboard",
    url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
  },
  {
    id: "media-3",
    name: "Founder workspace",
    url: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80",
  },
];

const starterActions = [
  {
    label: "Find post ideas",
    description: "Angles pulled from what you've been working on",
    command: "/ideas",
    icon: Sparkles,
  },
  {
    label: "Write from an idea",
    description: "Turn one line into a finished post",
    command: "/write",
    icon: PenLine,
  },
  {
    label: "Write from a link",
    description: "Summarise an article in your voice",
    command: "/link",
    icon: Link2,
  },
  {
    label: "Repurpose a post",
    description: "Rework something that already performed",
    command: "/repurpose",
    icon: Repeat2,
  },
];

const toneOptions = ["Founder voice", "Contrarian", "Storyteller", "Technical"];

const lengthOptions = ["Short", "Standard", "Long form"];

const emojiSet = [
  "🚀",
  "🔥",
  "💡",
  "📈",
  "🎯",
  "✨",
  "👋",
  "🤝",
  "📊",
  "🏆",
  "💬",
  "👇",
];

/* -------------------------------------------------------------------------- */
/* Post analysis — every number here is measured, nothing is invented          */
/* -------------------------------------------------------------------------- */

function analysePost(content: string) {
  const text = content.trim();
  const firstLine = text.split("\n")[0] ?? "";
  const paragraphs = text ? text.split(/\n{2,}/).filter(Boolean).length : 0;
  const hashtags = text.match(/#[\p{L}\d_]+/gu) ?? [];
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    isEmpty: text.length === 0,
    words,
    paragraphs,
    hashtagCount: hashtags.length,
    checks: [
      {
        id: "hook",
        label: "Opening line stays under 120 characters",
        passed: firstLine.length > 0 && firstLine.length <= 120,
      },
      {
        id: "spacing",
        label: "Broken into at least three paragraphs",
        passed: paragraphs >= 3,
      },
      {
        id: "cta",
        label: "Closes with a question",
        passed: /\?\s*(#[\p{L}\d_]+\s*)*$/u.test(text),
      },
      {
        id: "hashtags",
        label: "Between three and five hashtags",
        passed: hashtags.length >= 3 && hashtags.length <= 5,
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function CreatePost({ open, setOpen }: CreatePostProps) {
  const [leftTab, setLeftTab] = useState<LeftTab>("assist");
  const [editorMode, setEditorMode] = useState<EditorMode>("edit");
  const [mobilePane, setMobilePane] = useState<MobilePane>("assistant");

  const [prompt, setPrompt] = useState("");
  const [postContent, setPostContent] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedIdeas, setGeneratedIdeas] = useState<PostIdea[] | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<string[]>([]);
  const [draftsList, setDraftsList] = useState<DraftItem[]>(initialDrafts);
  const [attachedMedia, setAttachedMedia] = useState<string | null>(null);

  const [tone, setTone] = useState(toneOptions[0]);
  const [postLength, setPostLength] = useState(lengthOptions[1]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const generationTimer = useRef<number | null>(null);

  const analysis = useMemo(() => analysePost(postContent), [postContent]);

  const overSeeMore = postContent.length > SEE_MORE_LIMIT;

  /* ---------------------------------------------------------------------- */
  /* Menus: one open at a time, dismissed on outside click or Escape         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;

      if (!target || !shellRef.current?.contains(target)) {
        setOpenMenu(null);
        return;
      }

      if (!target.closest("[data-menu-root]")) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      // Close the menu before the dialog sees the key.
      event.preventDefault();
      event.stopPropagation();
      setOpenMenu(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [openMenu]);

  /* ---------------------------------------------------------------------- */
  /* Timers are cleared on unmount so nothing writes to a closed dialog      */
  /* ---------------------------------------------------------------------- */

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (generationTimer.current) window.clearTimeout(generationTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      setOpenMenu(null);
      setPreviewExpanded(false);
    }
  }, [open]);

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* ---------------------------------------------------------------------- */

  const showToast = useCallback((message: string) => {
    setToastMessage(message);

    if (toastTimer.current) window.clearTimeout(toastTimer.current);

    toastTimer.current = window.setTimeout(() => setToastMessage(null), 2600);
  }, []);

  const toggleMenu = (name: MenuName) =>
    setOpenMenu((current) => (current === name ? null : name));

  /**
   * Replace the body of this function with the real generation endpoint.
   * The loading, error, and history handling around it already works against
   * a promise, so only the request itself needs to change.
   */
  const requestGeneration = (input: string) =>
    new Promise<{ ideas?: PostIdea[]; draft?: string }>((resolve) => {
      generationTimer.current = window.setTimeout(() => {
        const normalised = input.toLowerCase();

        if (normalised.includes("/ideas") || normalised.includes("idea")) {
          resolve({ ideas: presetPostIdeas });
          return;
        }

        if (normalised.includes("/repurpose")) {
          resolve({
            draft: `Here's a tighter version of that post.

Lead with the strongest insight.

Cut the context nobody asked for.

Make the takeaway usable inside a minute.

End with a question worth answering.

Simple posts outperform complicated ones when the idea underneath is strong.

What's one idea you've been overcomplicating?`,
          });
          return;
        }

        const subject =
          input.replace(/^\/[a-zA-Z]+\s*/, "").trim() || "building products";

        resolve({
          draft: `An unpopular opinion about ${subject}.

Most people get this backwards.

They optimise the part that's easy to measure and ignore the part that decides the outcome.

The better approach is simple.

Focus on signal, not vanity metrics.

Talk to real users every week.

Automate the repetitive work.

Keep the parts that need judgement human.

Clarity compounds.

What's your take?`,
        });
      }, 900);
    });

  const triggerGeneration = async (customPrompt?: string) => {
    const input = (customPrompt ?? prompt).trim();

    if (!input || isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedIdeas(null);
    setGeneratedDraft(null);
    setOpenMenu(null);

    setHistoryList((previous) =>
      previous.includes(input) ? previous : [input, ...previous].slice(0, 8),
    );

    try {
      const result = await requestGeneration(input);

      if (result.ideas) setGeneratedIdeas(result.ideas);
      if (result.draft) setGeneratedDraft(result.draft);
    } catch {
      setGenerationError("That didn't go through. Try running it again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStarterAction = (command: string) => {
    setPrompt(command);
    void triggerGeneration(command);
  };

  const insertIntoComposer = (draft: string) => {
    setPostContent(draft);
    setEditorMode("edit");
    setMobilePane("editor");
    setPreviewExpanded(false);
    showToast("Added to the composer");
  };

  const handleNewDraft = () => {
    if (postContent.trim()) {
      const flattened = postContent.replace(/\s+/g, " ").trim();

      setDraftsList((previous) => [
        {
          id: `draft-${Date.now()}`,
          title:
            flattened.length > 52 ? `${flattened.slice(0, 52)}…` : flattened,
          content: postContent,
          savedAt: "Just now",
        },
        ...previous,
      ]);

      showToast("Saved to drafts");
    }

    setPostContent("");
    setAttachedMedia(null);
    setEditorMode("edit");
  };

  const handleDeleteDraft = (id: string) => {
    setDraftsList((previous) => previous.filter((draft) => draft.id !== id));
    showToast("Draft deleted");
  };

  const appendToPost = (addition: string) => {
    setPostContent((current) =>
      current.trim() ? `${current.trimEnd()}\n\n${addition}` : addition,
    );
  };

  const attachMedia = (url: string) => {
    setAttachedMedia(url);
    showToast("Media attached");
  };

  const schedulePost = (label: string) => {
    setOpenMenu(null);

    if (!postContent.trim()) {
      showToast("Write something before scheduling");
      return;
    }

    showToast(`Scheduled for ${label}`);
  };

  const requireContent = (action: () => void) => () => {
    if (!postContent.trim()) {
      showToast("Write something first");
      return;
    }

    action();
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={cn(
          "!w-[96vw] !max-w-[1180px]",
          "!h-[94vh] sm:!h-[88vh] !max-h-[780px]",
          "flex flex-col gap-0 overflow-hidden p-0",
          "rounded-xl sm:rounded-2xl",
          "border border-border bg-background",
          "shadow-[0_32px_90px_-24px_rgba(15,23,42,0.32)]",
          "[&>button]:hidden",
        )}
      >
        <DialogTitle className="sr-only">Create a LinkedIn post</DialogTitle>

        <div ref={shellRef} className="flex min-h-0 flex-1 flex-col">
          {/* =============================================================== */}
          {/* Toast                                                           */}
          {/* =============================================================== */}

          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "pointer-events-none absolute left-1/2 top-4 z-50",
                "flex -translate-x-1/2 items-center gap-2 whitespace-nowrap",
                "rounded-full bg-foreground px-4 py-2",
                "text-sm font-medium text-background shadow-lg",
              )}
            >
              <Check className="size-4" />
              {toastMessage}
            </div>
          )}

          {/* =============================================================== */}
          {/* Top bar                                                         */}
          {/* =============================================================== */}

          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-4">
            <div className="relative min-w-0" data-menu-root>
              <Button
                variant="ghost"
                onClick={() => toggleMenu("account")}
                aria-expanded={openMenu === "account"}
                className="h-10 max-w-full gap-2.5 px-1.5"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: BRAND_GRADIENT }}
                >
                  AS
                </span>

                <span className="min-w-0 text-left">
                  <span className="font-subheading block truncate text-sm font-medium leading-tight text-foreground">
                    Ajay Singh
                  </span>
                  <span className="hidden text-xs leading-tight text-muted-foreground sm:block">
                    Posting to LinkedIn
                  </span>
                </span>

                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </Button>

              {openMenu === "account" && (
                <div className={cn(menuSurface, "left-0 top-full mt-2 w-64")}>
                  <div className="flex items-center gap-3 px-1 pb-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ background: BRAND_GRADIENT }}
                    >
                      AS
                    </span>

                    <div className="min-w-0">
                      <p className="font-subheading truncate text-sm font-medium text-foreground">
                        Ajay Singh
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        Founder at Outlify
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-border px-1 pt-3 text-sm text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Account connected
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div
                className={cn(
                  mobilePane === "editor" ? "block" : "hidden",
                  "md:block",
                )}
              >
                <Tabs
                  value={editorMode}
                  onValueChange={(value) => setEditorMode(value as EditorMode)}
                >
                  <TabsList className="h-9 rounded-lg bg-muted p-1">
                    <TabsTrigger value="edit" className={segmentClass}>
                      <PenLine className="size-3.5" />
                      <span className="hidden sm:inline">Write</span>
                    </TabsTrigger>

                    <TabsTrigger value="preview" className={segmentClass}>
                      <Eye className="size-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
          </header>

          {/* Mobile pane switch */}
          <div className="shrink-0 border-b border-border p-2 md:hidden">
            <Tabs
              value={mobilePane}
              onValueChange={(value) => setMobilePane(value as MobilePane)}
            >
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted p-1">
                <TabsTrigger value="assistant" className={segmentClass}>
                  Assistant
                </TabsTrigger>
                <TabsTrigger value="editor" className={segmentClass}>
                  Composer
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* =============================================================== */}
          {/* Workspace                                                       */}
          {/* =============================================================== */}

          <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(320px,40%)_1fr] xl:grid-cols-[minmax(360px,38%)_1fr]">
            {/* ============================================================= */}
            {/* LEFT — assistant                                              */}
            {/* ============================================================= */}

            <aside
              className={cn(
                "min-h-0 flex-col border-border  bg-primary md:border-r",
                mobilePane === "assistant" ? "flex" : "hidden md:flex",
              )}
            >
              <Tabs
                value={leftTab}
                onValueChange={(value) => setLeftTab(value as LeftTab)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 p-3 pb-1">
                  <TabsList className="grid h-11 w-full grid-cols-4 rounded-lg bg-white p-1 shadow-xs">
                    <TabsTrigger value="assist" className={panelTabClass}>
                      <Sparkles className="size-4 text-red-500 shrink-0" />
                      <span className="truncate">Assist</span>
                    </TabsTrigger>

                    <TabsTrigger value="drafts" className={panelTabClass}>
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">Drafts</span>
                      <span className="rounded bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {draftsList.length}
                      </span>
                    </TabsTrigger>

                    <TabsTrigger value="media" className={panelTabClass}>
                      <ImageIcon className="size-4 shrink-0" />
                      <span className="truncate">Media</span>
                    </TabsTrigger>

                    <TabsTrigger value="review" className={panelTabClass}>
                      <Gauge className="size-4 shrink-0" />
                      <span className="truncate">Review</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* ========================================================= */}
                {/* ASSIST                                                    */}
                {/* ========================================================= */}

                <TabsContent
                  value="assist"
                  className="m-0 flex min-h-0 flex-1 flex-col border-0 p-0 focus-visible:ring-0"
                >
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                    {isGenerating && (
                      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
                        <Loader2
                          className="size-5 animate-spin"
                          style={{ color: BRAND }}
                        />
                        <p className="text-sm text-muted-foreground">
                          Writing in your {tone.toLowerCase()},{" "}
                          {postLength.toLowerCase()} length
                        </p>
                      </div>
                    )}

                    {!isGenerating &&
                      !generatedIdeas &&
                      !generatedDraft &&
                      !generationError && (
                        <div className="px-4 py-5">
                          <h2 className="font-heading text-xl font-semibold tracking-[-0.02em] text-foreground">
                            Start a post
                          </h2>

                          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                            Pick a starting point, or describe what you want to
                            say in the box below.
                          </p>

                          <div className="mt-5 space-y-2">
                            {starterActions.map((action) => {
                              const Icon = action.icon;

                              return (
                                <button
                                  key={action.command}
                                  type="button"
                                  onClick={() =>
                                    handleStarterAction(action.command)
                                  }
                                  className={cn(
                                    "group flex shadow-sm w-full items-start gap-3",
                                    "rounded-lg border border-border/50 bg-background",
                                    "px-3.5 py-3 text-left",
                                    "transition-colors hover:border-border/50 hover:bg-primary/5",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  )}
                                >
                                  <Icon
                                    className="mt-0.5 size-4 shrink-0"
                                    style={{ color: BRAND }}
                                  />

                                  <span className="min-w-0 flex-1">
                                    <span className="font-subheading block text-sm font-medium text-foreground">
                                      {action.label}
                                    </span>
                                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                                      {action.description}
                                    </span>
                                  </span>

                                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {!isGenerating && generationError && (
                      <div className="px-4 py-5">
                        <p className="text-sm text-destructive">
                          {generationError}
                        </p>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void triggerGeneration(prompt)}
                          className="mt-3 h-9 text-sm"
                        >
                          Run it again
                        </Button>
                      </div>
                    )}

                    {!isGenerating && generatedIdeas && (
                      <div className="px-4 py-5">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-heading text-base font-semibold text-foreground">
                            Ideas
                          </h3>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setGeneratedIdeas(null)}
                            className="h-8 text-sm text-muted-foreground"
                          >
                            Clear
                          </Button>
                        </div>

                        <div className="mt-3 space-y-2.5">
                          {generatedIdeas.map((idea) => (
                            <article
                              key={idea.id}
                              className="rounded-lg border border-border bg-background p-3.5"
                            >
                              <p className="font-subheading text-sm font-medium leading-5 text-foreground">
                                {idea.title}
                              </p>

                              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                                {idea.hook}
                              </p>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {idea.angle}
                                </span>

                                <Button
                                  size="sm"
                                  onClick={() =>
                                    insertIntoComposer(idea.fullDraft)
                                  }
                                  className="primary-btn h-8 px-3 text-sm"
                                >
                                  Use this
                                </Button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isGenerating && generatedDraft && (
                      <div className="px-4 py-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-heading text-base font-semibold text-foreground">
                            Draft
                          </h3>

                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setGeneratedDraft(null)}
                              className="h-8 text-sm text-muted-foreground"
                            >
                              Back
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => insertIntoComposer(generatedDraft)}
                              className="primary-btn h-8 px-3 text-sm"
                            >
                              Insert
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-border bg-background p-4">
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {generatedDraft}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Prompt composer */}
                  <div className="shrink-0 border-t border-border shadow-xs  zbg-muted/40 p-3">
                    <div className="rounded-xl border border-border bg-background shadow-sm transition-colors focus-within:border-foreground/25">
                      <label htmlFor="assist-prompt" className="sr-only">
                        Describe the post you want
                      </label>

                      <Textarea
                        id="assist-prompt"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void triggerGeneration();
                          }
                        }}
                        placeholder="Describe the post you want, or type / for a command"
                        className={cn(
                          "no-scrollbar min-h-[76px] resize-none",
                          "border-0 bg-transparent px-3.5 py-3",
                          "text-sm leading-6 text-foreground shadow-none",
                          "placeholder:text-muted-foreground",
                          "focus-visible:ring-0",
                        )}
                      />

                      <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
                        <div className="flex min-w-0 items-center gap-0.5">
                          {/* Adjust */}
                          <div className="relative" data-menu-root>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMenu("adjust")}
                              aria-expanded={openMenu === "adjust"}
                              className="h-8 max-w-[9.5rem] gap-1.5 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
                            >
                              <SlidersHorizontal className="size-3.5 shrink-0" />
                              <span className="truncate">{tone}</span>
                            </Button>

                            {openMenu === "adjust" && (
                              <div
                                className={cn(
                                  menuSurface,
                                  "bottom-full left-0 mb-2 w-64",
                                )}
                              >
                                <div className="space-y-3 px-1">
                                  <div>
                                    <label
                                      htmlFor="tone-select"
                                      className="font-subheading text-sm font-medium text-foreground"
                                    >
                                      Tone
                                    </label>

                                    <select
                                      id="tone-select"
                                      value={tone}
                                      onChange={(event) =>
                                        setTone(event.target.value)
                                      }
                                      className={selectClass}
                                    >
                                      {toneOptions.map((option) => (
                                        <option key={option}>{option}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label
                                      htmlFor="length-select"
                                      className="font-subheading text-sm font-medium text-foreground"
                                    >
                                      Length
                                    </label>

                                    <select
                                      id="length-select"
                                      value={postLength}
                                      onChange={(event) =>
                                        setPostLength(event.target.value)
                                      }
                                      className={selectClass}
                                    >
                                      {lengthOptions.map((option) => (
                                        <option key={option}>{option}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <Button
                                  size="sm"
                                  onClick={() => setOpenMenu(null)}
                                  className="primary-btn mt-4 h-9 w-full text-sm"
                                >
                                  Apply
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* History */}
                          <div className="relative" data-menu-root>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMenu("history")}
                              aria-expanded={openMenu === "history"}
                              className="h-8 gap-1.5 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
                            >
                              <History className="size-3.5" />
                              <span className="hidden lg:inline">History</span>
                            </Button>

                            {openMenu === "history" && (
                              <div
                                className={cn(
                                  menuSurface,
                                  "bottom-full left-0 mb-2 w-[17rem]",
                                )}
                              >
                                {historyList.length === 0 ? (
                                  <p className="px-1 py-2 text-sm text-muted-foreground">
                                    Your recent prompts show up here.
                                  </p>
                                ) : (
                                  <div className="space-y-0.5">
                                    {historyList.map((item) => (
                                      <button
                                        key={item}
                                        type="button"
                                        onClick={() => {
                                          setPrompt(item);
                                          setOpenMenu(null);
                                        }}
                                        className="w-full truncate rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
                                      >
                                        {item}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Commands */}
                          <div className="relative" data-menu-root>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMenu("commands")}
                              aria-expanded={openMenu === "commands"}
                              className="h-8 gap-1.5 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
                            >
                              <Zap className="size-3.5" />
                              <span className="hidden lg:inline">Commands</span>
                            </Button>

                            {openMenu === "commands" && (
                              <div
                                className={cn(
                                  menuSurface,
                                  "bottom-full left-0 mb-2 w-[17rem]",
                                )}
                              >
                                <div className="space-y-0.5">
                                  {starterActions.map((action) => (
                                    <button
                                      key={action.command}
                                      type="button"
                                      onClick={() => {
                                        setOpenMenu(null);
                                        handleStarterAction(action.command);
                                      }}
                                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
                                    >
                                      <span className="truncate text-sm text-foreground">
                                        {action.label}
                                      </span>
                                      <span
                                        className="shrink-0 text-xs font-medium"
                                        style={{ color: BRAND }}
                                      >
                                        {action.command}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="icon"
                          aria-label="Generate"
                          onClick={() => void triggerGeneration()}
                          disabled={!prompt.trim() || isGenerating}
                          className="primary-btn size-9 shrink-0 rounded-lg"
                        >
                          {isGenerating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Send className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ========================================================= */}
                {/* DRAFTS                                                    */}
                {/* ========================================================= */}

                <TabsContent
                  value="drafts"
                  className="no-scrollbar m-0 min-h-0 flex-1 overflow-y-auto border-0 px-4 py-5 focus-visible:ring-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading text-lg font-semibold tracking-[-0.01em] text-foreground">
                        Drafts
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Pick one up where you left it.
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNewDraft}
                      className="h-9 shrink-0 gap-1.5 text-sm"
                    >
                      <Plus className="size-4" />
                      New
                    </Button>
                  </div>

                  {draftsList.length === 0 ? (
                    <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm leading-6 text-muted-foreground">
                      Nothing saved yet. Whatever is in the composer lands here
                      when you start a new draft.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {draftsList.map((draft) => (
                        <div
                          key={draft.id}
                          className="rounded-lg border border-border bg-background transition-colors hover:border-foreground/20"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setPostContent(draft.content);
                              setEditorMode("edit");
                              setMobilePane("editor");
                              setPreviewExpanded(false);
                            }}
                            className="w-full rounded-t-lg px-3.5 pb-2 pt-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <p className="font-subheading line-clamp-1 text-sm font-medium text-foreground">
                              {draft.title}
                            </p>

                            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted-foreground">
                              {draft.content}
                            </p>
                          </button>

                          <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5 pt-1">
                            <span className="truncate text-xs tabular-nums text-muted-foreground">
                              {draft.savedAt}, {draft.content.length} characters
                            </span>

                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete draft: ${draft.title}`}
                              onClick={() => handleDeleteDraft(draft.id)}
                              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ========================================================= */}
                {/* MEDIA                                                     */}
                {/* ========================================================= */}

                <TabsContent
                  value="media"
                  className="no-scrollbar m-0 min-h-0 flex-1 overflow-y-auto border-0 px-4 py-5 focus-visible:ring-0"
                >
                  <h3 className="font-heading text-lg font-semibold tracking-[-0.01em] text-foreground">
                    Media
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    One image per post. PNG, JPG or WEBP.
                  </p>

                  <button
                    type="button"
                    onClick={() => attachMedia(mediaPresets[0].url)}
                    className={cn(
                      "mt-4 flex w-full flex-col items-center gap-2",
                      "rounded-lg border border-dashed border-border bg-background",
                      "px-4 py-7 text-center transition-colors",
                      "hover:border-foreground/25 hover:bg-accent",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <Upload className="size-5 text-muted-foreground" />

                    <span className="font-subheading text-sm font-medium text-foreground">
                      Choose a file
                    </span>

                    <span className="text-sm text-muted-foreground">
                      Up to 5 MB
                    </span>
                  </button>

                  <p className="font-subheading mt-6 text-sm font-medium text-foreground">
                    Recently used
                  </p>

                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {mediaPresets.map((media) => {
                      const selected = attachedMedia === media.url;

                      return (
                        <button
                          key={media.id}
                          type="button"
                          onClick={() => attachMedia(media.url)}
                          aria-pressed={selected}
                          className={cn(
                            "overflow-hidden rounded-lg border bg-background text-left transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-transparent"
                              : "border-border hover:border-foreground/20",
                          )}
                          style={
                            selected
                              ? { boxShadow: `0 0 0 2px ${BRAND}` }
                              : undefined
                          }
                        >
                          <img
                            src={media.url}
                            alt={media.name}
                            loading="lazy"
                            className="h-20 w-full object-cover"
                          />

                          <span className="block truncate px-2 py-2 text-xs text-muted-foreground">
                            {media.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* ========================================================= */}
                {/* REVIEW                                                    */}
                {/* ========================================================= */}

                <TabsContent
                  value="review"
                  className="no-scrollbar m-0 min-h-0 flex-1 overflow-y-auto border-0 px-4 py-5 focus-visible:ring-0"
                >
                  <h3 className="font-heading text-lg font-semibold tracking-[-0.01em] text-foreground">
                    Review
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    How the draft reads before it goes out.
                  </p>

                  {analysis.isEmpty ? (
                    <p className="mt-6 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm leading-6 text-muted-foreground">
                      Write something in the composer and this fills in as you
                      type.
                    </p>
                  ) : (
                    <>
                      <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
                        <Stat label="Words" value={analysis.words} />
                        <Stat label="Paragraphs" value={analysis.paragraphs} />
                        <Stat label="Hashtags" value={analysis.hashtagCount} />
                      </dl>

                      <div className="mt-3 space-y-2">
                        {analysis.checks.map((check) => (
                          <div
                            key={check.id}
                            className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3.5 py-3"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                                check.passed
                                  ? "bg-emerald-500 text-white"
                                  : "border border-border",
                              )}
                            >
                              {check.passed && <Check className="size-3" />}
                            </span>

                            <span
                              className={cn(
                                "text-sm leading-5",
                                check.passed
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <p className="font-subheading mt-6 text-sm font-medium text-foreground">
                    Quick edits
                  </p>

                  <div className="mt-2.5 space-y-2">
                    <QuickEdit
                      title="Sharpen the opening"
                      description="Adds a line that stops the scroll"
                      onClick={requireContent(() =>
                        setPostContent(
                          (current) =>
                            `Stop scrolling for a second.\n\n${current}`,
                        ),
                      )}
                    />

                    <QuickEdit
                      title="Open up the spacing"
                      description="Splits long blocks into single lines"
                      onClick={requireContent(() =>
                        setPostContent((current) =>
                          current.replace(/([.!?])\s+(?=[A-Z])/g, "$1\n\n"),
                        ),
                      )}
                    />

                    <QuickEdit
                      title="Add a closing question"
                      description="Gives people a reason to comment"
                      onClick={requireContent(() =>
                        appendToPost("What's your take?"),
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </aside>

            {/* ============================================================= */}
            {/* RIGHT — composer                                              */}
            {/* ============================================================= */}

            <main
              className={cn(
                "min-h-0 flex-col",
                mobilePane === "editor" ? "flex" : "hidden md:flex",
                editorMode == "edit" ? "bg-background" : "bg-[#f2f0eb]"
              )}
            >
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
                {editorMode === "edit" ? (
                  <div className="mx-auto flex h-full w-full max-w-[720px] flex-col px-4 py-5 sm:px-8 sm:py-7">
                    <label htmlFor="post-body" className="sr-only">
                      Post content
                    </label>

                    <Textarea
                      id="post-body"
                      value={postContent}
                      onChange={(event) => setPostContent(event.target.value)}
                      maxLength={MAX_LENGTH}
                      placeholder="What do you want to talk about?"
                      className={cn(
                        "no-scrollbar min-h-[220px] flex-1 resize-none",
                        "border-0 bg-transparent p-0",
                        "text-[15px] leading-7 text-foreground shadow-none",
                        "placeholder:text-muted-foreground",
                        "focus-visible:ring-0",
                      )}
                    />

                    {attachedMedia && (
                      <div className="relative mt-5 w-full max-w-[280px] overflow-hidden rounded-lg border border-border">
                        <img
                          src={attachedMedia}
                          alt="Attached to this post"
                          className="h-32 w-full object-cover"
                        />

                        <button
                          type="button"
                          aria-label="Remove attachment"
                          onClick={() => setAttachedMedia(null)}
                          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-foreground/80 text-background backdrop-blur-sm transition-colors hover:bg-foreground"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-[600px] px-4 py-5 sm:px-6 sm:py-7">
                    <article className="overflow-hidden rounded-lg border border-border shadow-sm bg-background">
                      <div className="flex items-start gap-3 px-4 pt-4">
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ background: BRAND_GRADIENT }}
                        >
                          AS
                        </span>

                        <div className="min-w-0">
                          <p className="font-subheading truncate text-sm font-medium text-foreground">
                            Ajay Singh
                          </p>

                          <p className="truncate text-sm text-muted-foreground">
                            Founder at Outlify
                          </p>

                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            Now
                            <Globe2 className="size-3" aria-hidden />
                            <span className="sr-only">Visible to anyone</span>
                          </p>
                        </div>
                      </div>

                      <div className="px-4 pt-3">
                        {postContent.trim() ? (
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                            <PostBody
                              text={
                                previewExpanded || !overSeeMore
                                  ? postContent
                                  : postContent.slice(0, SEE_MORE_LIMIT)
                              }
                            />

                            {overSeeMore && !previewExpanded && (
                              <>
                                {"… "}
                                <button
                                  type="button"
                                  onClick={() => setPreviewExpanded(true)}
                                  className="font-medium text-muted-foreground hover:underline"
                                >
                                  see more
                                </button>
                              </>
                            )}
                          </p>
                        ) : (
                          <p className="text-sm leading-6 text-muted-foreground">
                            Your post appears here exactly as it will in the
                            feed.
                          </p>
                        )}
                      </div>

                      {attachedMedia && (
                        <img
                          src={attachedMedia}
                          alt="Attached to this post"
                          className="mt-3 max-h-80 w-full object-cover"
                        />
                      )}

                      <div className="mt-3 grid grid-cols-4 border-t border-border">
                        <PreviewAction icon={ThumbsUp} label="Like" />
                        <PreviewAction icon={MessageSquare} label="Comment" />
                        <PreviewAction icon={Repeat2} label="Repost" />
                        <PreviewAction icon={Send} label="Send" />
                      </div>
                    </article>

                    {overSeeMore && (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Everything past{" "}
                        <span className="tabular-nums">{SEE_MORE_LIMIT}</span>{" "}
                        characters sits behind “see more”.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Formatting bar */}
              {editorMode === "edit" && (
                <div className="flex h-12 shrink-0 items-center gap-0.5 border-t border-border px-2 sm:px-3">
                  <EditorTool
                    icon={Gauge}
                    label="Insert a poll"
                    onClick={() =>
                      appendToPost(
                        `Quick poll: what's your biggest priority this quarter?\n\nGrowing pipeline\nHiring\nShipping faster\nImproving margins`,
                      )
                    }
                  />

                  <EditorTool
                    icon={GalleryHorizontal}
                    label="Outline a carousel"
                    onClick={() =>
                      appendToPost(
                        `Carousel outline\n\nSlide 1: the problem\nSlide 2: why it matters\nSlide 3: the framework\nSlide 4: an example\nSlide 5: the takeaway`,
                      )
                    }
                  />

                  <div className="relative" data-menu-root>
                    <EditorTool
                      icon={TypeIcon}
                      label="Text styles"
                      expanded={openMenu === "format"}
                      onClick={() => toggleMenu("format")}
                    />

                    {openMenu === "format" && (
                      <div
                        className={cn(
                          menuSurface,
                          "bottom-full left-0 mb-2 w-56",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setPostContent(
                              (current) => `𝗕𝗼𝗹𝗱 𝗵𝗲𝗮𝗱𝗹𝗶𝗻𝗲\n\n${current}`,
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
                        >
                          𝗕𝗼𝗹𝗱 𝗵𝗲𝗮𝗱𝗹𝗶𝗻𝗲
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            appendToPost("𝘐𝘵𝘢𝘭𝘪𝘤 𝘦𝘮𝘱𝘩𝘢𝘴𝘪𝘴");
                            setOpenMenu(null);
                          }}
                          className="w-full rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-accent"
                        >
                          𝘐𝘵𝘢𝘭𝘪𝘤 𝘦𝘮𝘱𝘩𝘢𝘴𝘪𝘴
                        </button>

                        <p className="px-2 pb-1 pt-2 text-xs leading-4 text-muted-foreground">
                          These use styled characters. Screen readers skip them.
                        </p>
                      </div>
                    )}
                  </div>

                  <EditorTool
                    icon={ImageIcon}
                    label="Add media"
                    onClick={() => {
                      setLeftTab("media");
                      setMobilePane("assistant");
                    }}
                  />

                  <EditorTool
                    icon={Gift}
                    label="Add a GIF"
                    onClick={() =>
                      attachMedia(
                        "https://media.giphy.com/media/unQ3IJU2RG7DO/giphy.gif",
                      )
                    }
                  />

                  <div className="relative" data-menu-root>
                    <EditorTool
                      icon={Smile}
                      label="Add an emoji"
                      expanded={openMenu === "emoji"}
                      onClick={() => toggleMenu("emoji")}
                    />

                    {openMenu === "emoji" && (
                      <div
                        className={cn(
                          menuSurface,
                          "bottom-full left-0 mb-2 grid w-60 grid-cols-6 gap-1",
                        )}
                      >
                        {emojiSet.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            aria-label={`Insert ${emoji}`}
                            onClick={() => {
                              setPostContent((current) => `${current}${emoji}`);
                              setOpenMenu(null);
                            }}
                            className="flex size-8 items-center justify-center rounded-md text-base hover:bg-accent"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex bg-background shrink-0 flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      postContent.length > MAX_LENGTH - 100
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {postContent.length.toLocaleString()} /{" "}
                    {MAX_LENGTH.toLocaleString()}
                  </span>

                  {overSeeMore && (
                    <span className="hidden text-sm text-muted-foreground lg:inline">
                      Past the “see more” cut
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    className="h-10 px-3 text-sm text-muted-foreground"
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleNewDraft}
                    className="h-10 gap-1.5 px-3 text-sm"
                  >
                    <Plus className="size-4" />
                    <span className="hidden sm:inline">New draft</span>
                    <span className="sm:hidden">Draft</span>
                  </Button>

                  <div className="relative flex gap-4" data-menu-root>
                    <Button
                      onClick={() => schedulePost("tomorrow at 12:00 PM")}
                      className="primary-btn h-10 rounded-r-none px-4 text-sm"
                    >
                      Schedule
                    </Button>

                    <Button
                      size="icon"
                      aria-label="Scheduling options"
                      aria-expanded={openMenu === "schedule"}
                      onClick={() => toggleMenu("schedule")}
                      className="primary-btn size-10 rounded-l-none border-l border-white/20"
                    >
                      <ChevronDown className="size-4" />
                    </Button>

                    {openMenu === "schedule" && (
                      <div
                        className={cn(
                          menuSurface,
                          "bottom-full right-0 mb-2 w-[min(17rem,calc(100vw-3rem))]",
                        )}
                      >
                        <ScheduleItem
                          icon={Zap}
                          label="Post now"
                          onClick={() => schedulePost("right now")}
                        />

                        <ScheduleItem
                          icon={Clock3}
                          label="Tomorrow, 12:00 PM"
                          onClick={() => schedulePost("tomorrow at 12:00 PM")}
                        />

                        <ScheduleItem
                          icon={TrendingUp}
                          label="Tuesday, 8:30 AM"
                          hint="When your audience is most active"
                          onClick={() => schedulePost("Tuesday at 8:30 AM")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared class fragments                                                     */
/* -------------------------------------------------------------------------- */

const segmentClass = cn(
  "h-full gap-1.5 rounded-md border-0 px-3 text-sm font-medium",
  "text-muted-foreground transition-colors hover:text-foreground",
  "data-[state=active]:bg-background data-[state=active]:text-foreground",
  "data-[state=active]:shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
);

const panelTabClass = cn(
  "h-full min-w-0 gap-1.5 rounded-md border-0 px-1.5 text-sm font-medium",
  "text-muted-foreground transition-colors hover:text-foreground",
  "data-[state=active]:bg-muted data-[state=active]:text-foreground",
  "data-[state=active]:shadow-none",
);

const menuSurface = cn(
  "absolute z-50 rounded-xl border border-border bg-background p-2.5",
  "shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)]",
);

const selectClass = cn(
  "mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2",
  "text-sm text-foreground outline-none",
  "focus-visible:ring-2 focus-visible:ring-ring",
);

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function PostBody({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\d_]+)/gu);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("#") ? (
          <span key={`${part}-${index}`} style={{ color: BRAND }}>
            {part}
          </span>
        ) : (
          <span key={`text-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-subheading mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function EditorTool({
  icon: Icon,
  label,
  onClick,
  expanded,
}: {
  icon: ElementType;
  label: string;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      className="size-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Icon className="size-4" />
    </Button>
  );
}

function PreviewAction({
  icon: Icon,
  label,
}: {
  icon: ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground"
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function QuickEdit({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3",
        "rounded-lg border border-border bg-background px-3.5 py-3 text-left",
        "transition-colors hover:border-foreground/20 hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="min-w-0">
        <span className="font-subheading block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
          {description}
        </span>
      </span>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function ScheduleItem({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: ElementType;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}
