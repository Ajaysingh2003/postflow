import {
  Sparkles,
  Wand2,
  Zap,
  PenLine,
  Target,
  Anchor,
  Lightbulb,
  Scale,
  Glasses,
  Maximize2,
  ListRestart,
  Plus,
  Flame,
  Brain,
  Rocket,
  Compass,
  Heart,
  Bookmark,
  FileText,
  CheckCheck,
  type LucideIcon,
} from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  isCustom?: boolean;
}

export const COMMAND_ICONS = {
  sparkles: Sparkles,
  wand: Wand2,
  anchor: Anchor,
  zap: Zap,
  pen: PenLine,
  target: Target,
  lightbulb: Lightbulb,
  scale: Scale,
  glasses: Glasses,
  maximize: Maximize2,
  list: ListRestart,
  plus: Plus,
  flame: Flame,
  brain: Brain,
  rocket: Rocket,
  compass: Compass,
  heart: Heart,
  bookmark: Bookmark,
  file: FileText,
  check: CheckCheck,
} satisfies Record<string, LucideIcon>;

export type CommandIconKey = keyof typeof COMMAND_ICONS;

export function getCommandIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return Sparkles;
  const key = iconName.toLowerCase() as CommandIconKey;
  return COMMAND_ICONS[key] || Sparkles;
}

export const DEFAULT_COMMANDS: CommandItem[] = [
  {
    id: "polish",
    label: "Polish",
    icon: "sparkles",
    prompt: `Polish the draft:

When changes are needed, include the polished post(s) in your response.
Apply the fixes directly; don't only list issues unless everything is already ready to go.

Make the smallest useful edits:
- Fix typos, grammar, punctuation, and obvious wrong words
- Smooth awkward or unclear phrasing with local edits
- Preserve my voice, meaning, post order, structure, and formatting

Include a concise note with up to 3 bullets on the changes you applied. If you see bigger improvements that you intentionally didn't apply, add them as optional suggestions at the end when useful.`,
    isCustom: false,
  },
  {
    id: "match-voice",
    label: "Match voice & style",
    icon: "wand",
    prompt: `Rewrite this post adapting it to my core brand voice and rhythm:
- Maintain an authentic, direct, and conversational tone.
- Avoid corporate buzzwords and artificial hype.
- Keep sentences concise, punchy, and engaging.`,
    isCustom: false,
  },
  {
    id: "optimize-hook",
    label: "Optimize hook",
    icon: "anchor",
    prompt: `Analyze and rewrite the first 1-2 lines as a magnetic, high-engagement hook:
- Provide 3 distinct hook variations (Curiosity, Contrarian, Problem/Pain-point).
- Ensure the reader stops scrolling on mobile feeds.
- Seamlessly transition from the hook into the body of the post.`,
    isCustom: false,
  },
  {
    id: "expand-ideas",
    label: "Expand on ideas",
    icon: "lightbulb",
    prompt: `Expand on the core ideas of this draft:
- Add concrete, real-world examples and tactical action steps.
- Deepen the insights without adding unnecessary fluff.
- Use clean formatting, spacing, and bullet points where helpful.`,
    isCustom: false,
  },
  {
    id: "critique",
    label: "Critique & improve",
    icon: "glasses",
    prompt: `Critique this draft honestly and suggest 3 high-impact improvements:
- Evaluate hook strength, clarity, flow, and call-to-action.
- Identify weak points or boring sentences.
- Give a quick revised version incorporating your critique.`,
    isCustom: false,
  },
  {
    id: "make-punchier",
    label: "Make it punchier",
    icon: "zap",
    prompt: `Make this draft significantly punchier and higher impact:
- Cut filler words and condense long paragraphs into 1-2 sentence thoughts.
- Use strong active verbs and bold cadence.
- Maximize readability on mobile screens.`,
    isCustom: false,
  },
  {
    id: "condense",
    label: "Condense",
    icon: "scale",
    prompt: `Condense this draft into a tight, high-signal post:
- Reduce word count by ~40% while preserving 100% of the core value.
- Eliminate repetition and rambling.`,
    isCustom: false,
  },
  {
    id: "variations",
    label: "Write 3 variations",
    icon: "list",
    prompt: `Generate 3 distinct creative variations of this draft:
1. Story-driven (personal narrative / lesson learned)
2. Framework / Step-by-step breakdown
3. Contrarian / Hot-take perspective`,
    isCustom: false,
  },
  {
    id: "something-new",
    label: "Write something new",
    icon: "plus",
    prompt: `Help me write an original, high-performing LinkedIn post from scratch:
- Propose a compelling perspective based on current industry trends.
- Structure it with an irresistible hook, insightful body, and conversation-starting question.`,
    isCustom: false,
  },
];
