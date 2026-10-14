import { z } from "zod";

const items = (max: number) =>
  z.array(z.string().trim().min(1).max(240)).max(max);
export const BRAND_CHANNELS = [
  {
    id: "x",
    name: "X",
    hint: "Short hooks, threads, and your preferred rhythm.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    hint: "Professional stories, lessons, and formatting.",
  },
  {
    id: "threads",
    name: "Threads",
    hint: "Conversation starters and everyday observations.",
  },
  {
    id: "instagram",
    name: "Instagram",
    hint: "Captions, hashtags, and the story behind your visuals.",
  },
  {
    id: "facebook",
    name: "Facebook",
    hint: "Your Page’s community, updates, and calls to action.",
  },
  {
    id: "bluesky",
    name: "Bluesky",
    hint: "Concise thoughts and conversations.",
  },
  {
    id: "mastodon",
    name: "Mastodon",
    hint: "Community norms and content warnings.",
  },
  {
    id: "reddit",
    name: "Reddit",
    hint: "Useful contributions; subreddit rules still take priority.",
  },
] as const;
export const brandSchema = z.object({
  display_name: z.string().trim().max(120),
  role: z.string().trim().max(240),
  bio: z.string().trim().max(2000),
  niche: z.string().trim().max(240),
  audience: z.string().trim().max(1500),
  expertise: items(10),
  goals: items(10),
  values: items(10),
  voice_traits: items(8),
  style_guide: z.string().trim().max(1500),
  writing_rules: z.string().trim().max(1500),
  preferred_formats: items(10),
  calls_to_action: items(10),
  restricted_topics: items(20),
  output_language: z.string().trim().max(80),
  sample_posts: z.array(z.string().trim().min(1).max(3000)).max(5),
  platform_instructions: z.partialRecord(
    z.enum([
      "x",
      "linkedin",
      "reddit",
      "bluesky",
      "mastodon",
      "facebook",
      "instagram",
      "threads",
    ]),
    z.string().trim().max(1000),
  ),
});
export type BrandDraft = z.infer<typeof brandSchema>;
export type BrandProfile = BrandDraft & {
  id: string | null;
  workspace_id: string;
  updated_at: string | null;
  can_edit: boolean;
};
export const EMPTY_BRAND: BrandDraft = {
  display_name: "",
  role: "",
  bio: "",
  niche: "",
  audience: "",
  expertise: [],
  goals: [],
  values: [],
  voice_traits: [],
  style_guide: "",
  writing_rules: "",
  preferred_formats: [],
  calls_to_action: [],
  restricted_topics: [],
  output_language: "",
  sample_posts: [],
  platform_instructions: {},
};
export function brandValues(profile: BrandProfile): BrandDraft {
  return Object.fromEntries(
    Object.keys(EMPTY_BRAND).map((key) => [
      key,
      profile[key as keyof BrandDraft],
    ]),
  ) as BrandDraft;
}
export function brandProgress(profile: BrandDraft) {
  const parts = [
    Boolean(profile.display_name || profile.role),
    Boolean(profile.bio || profile.niche),
    Boolean(profile.audience),
    profile.voice_traits.length > 0 || Boolean(profile.style_guide),
    profile.sample_posts.some((sample) => sample.trim()),
  ];
  return { completed: parts.filter(Boolean).length, total: parts.length };
}
export const VOICE_TRAITS = [
  "Conversational",
  "Direct",
  "Thoughtful",
  "Warm",
  "Practical",
  "Playful",
  "Confident",
  "Analytical",
];
