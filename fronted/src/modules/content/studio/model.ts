import type {
  Account,
  Feature,
  Payload,
  Variant,
} from "@/modules/studio/types";

export type WritingDraft = {
  localId: string;
  variant: Variant | null;
  payload: Payload;
  mediaIds: string[];
  saved: string;
};

export const EDITOR_PROFILES: Record<
  string,
  { name: string; placeholder: string; help: string; textKey: string }
> = {
  x: {
    name: "X",
    placeholder: "What’s happening?",
    help: "A sharp opening. One idea per post. Room for a conversation.",
    textKey: "text",
  },
  linkedin: {
    name: "LinkedIn",
    placeholder: "What do you want to talk about?",
    help: "Start with a hook, share your experience, and give people something useful.",
    textKey: "text",
  },
  reddit: {
    name: "Reddit",
    placeholder: "Tell the community what you have in mind…",
    help: "Write for the community. Check its rules, add context, and be honest about self-promotion.",
    textKey: "body",
  },
  bluesky: {
    name: "Bluesky",
    placeholder: "What’s up?",
    help: "Short posts, thoughtful threads, and descriptive alt text.",
    textKey: "text",
  },
  mastodon: {
    name: "Mastodon",
    placeholder: "What’s on your mind?",
    help: "Respect your instance’s limits. Add content warnings and choose your audience.",
    textKey: "text",
  },
  facebook: {
    name: "Facebook",
    placeholder: "Share an update with your Page…",
    help: "Useful updates, natural questions, and a clear next step.",
    textKey: "text",
  },
  instagram: {
    name: "Instagram",
    placeholder: "Write a caption…",
    help: "Lead with the story. Add the right media and a considered hashtag set.",
    textKey: "caption",
  },
  threads: {
    name: "Threads",
    placeholder: "Start a thread…",
    help: "A conversational thought, a strong opening, and room for replies.",
    textKey: "text",
  },
};

export function profileFor(platform: string) {
  return EDITOR_PROFILES[platform] ?? EDITOR_PROFILES.linkedin;
}

export function xLength(value: string): number {
  const text = value
    .normalize("NFC")
    .replace(/https?:\/\/[^\s<>]+/g, "a".repeat(23));
  let count = 0;
  for (const { segment } of new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  }).segment(text)) {
    if (
      /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(segment)
    ) {
      count += 2;
    } else {
      for (const char of segment) {
        const code = char.codePointAt(0)!;
        count +=
          code <= 0x10ff ||
          (code >= 0x2000 && code <= 0x200d) ||
          (code >= 0x2010 && code <= 0x201f) ||
          (code >= 0x2032 && code <= 0x2037)
            ? 1
            : 2;
      }
    }
  }
  return count;
}

export function textLength(
  value: string,
  platform: string,
  counting?: unknown,
) {
  return platform === "x"
    ? xLength(value)
    : counting === "graphemes"
      ? [
          ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
            value,
          ),
        ].length
      : [...value].length;
}

export function threadItems(payload: Payload): Payload[] {
  return Array.isArray(payload.thread) && payload.thread.length
    ? payload.thread.map((item) =>
        typeof item === "string" ? { text: item } : { ...item },
      )
    : [{ ...payload }];
}

export function updateThread(
  payload: Payload,
  index: number,
  changes: Payload,
) {
  const items = threadItems(payload);
  items[index] = { ...items[index], ...changes };
  return items.length === 1 ? items[0] : { thread: items };
}

export function draftText(payload: Payload, platform: string) {
  if (Array.isArray(payload.thread))
    return threadItems(payload)
      .map((item) => String(item.text ?? ""))
      .join("\n\n");
  return String(payload[profileFor(platform).textKey] ?? "");
}

export function fingerprint(payload: Payload, mediaIds: string[]) {
  return JSON.stringify({ payload, mediaIds });
}

export function newDraft(
  platform: string,
  variant: Variant | null = null,
): WritingDraft {
  const payload = variant
    ? structuredClone(variant.payload)
    : platform === "reddit"
      ? {
          subreddit: "",
          title: "",
          body: "",
          post_type: "text",
          url: null,
          flair_id: null,
        }
      : { [profileFor(platform).textKey]: "" };
  const mediaIds = variant?.media_asset_ids ?? [];
  return {
    localId: variant?.id ?? crypto.randomUUID(),
    variant,
    payload,
    mediaIds,
    saved: fingerprint(payload, mediaIds),
  };
}

export function canEditDraft(variant: Variant | null) {
  return (
    !variant ||
    (["draft", "failed", "rejected"].includes(variant.status) &&
      !variant.publish_state?.outcome_unknown &&
      !(variant.publish_state?.thread_ids as unknown[])?.length &&
      !(variant.publish_state?.thread_posts as unknown[])?.length)
  );
}

export function readDraft(key: string, account: Account): WritingDraft {
  try {
    const draft = JSON.parse(
      localStorage.getItem(key) ?? "null",
    ) as WritingDraft | null;
    if (
      draft?.localId &&
      draft.payload &&
      typeof draft.payload === "object" &&
      !Array.isArray(draft.payload) &&
      Array.isArray(draft.mediaIds) &&
      typeof draft.saved === "string" &&
      (!draft.variant || draft.variant.connected_account_id === account.id)
    )
      return draft;
  } catch {
    /* An unreadable local backup does not prevent opening the editor. */
  }
  return newDraft(account.platform);
}

export function featureDefaults(
  feature: Feature,
  payload: Payload,
  platform: string,
): Record<string, string> {
  const text = draftText(payload, platform);
  const defaults: Record<string, string> = {};
  for (const [name, field] of Object.entries(
    feature.input_schema.properties ?? {},
  )) {
    if (
      [
        "text",
        "draft",
        "post_content",
        "source_content",
        "source_text",
      ].includes(name)
    )
      defaults[name] = text;
    else if (name === "subreddit")
      defaults[name] = String(payload.subreddit ?? "");
    else if (name === "title") defaults[name] = String(payload.title ?? "");
    else if (name === "body") defaults[name] = String(payload.body ?? "");
    else if (name === "thread_tweets")
      defaults[name] = threadItems(payload)
        .map((item) => String(item.text ?? ""))
        .join("\n");
    else if (name === "source_platform") defaults[name] = platform;
    else if (name === "target_platforms") defaults[name] = platform;
    else if (field.default != null)
      defaults[name] = Array.isArray(field.default)
        ? field.default.join("\n")
        : String(field.default);
  }
  return defaults;
}

// Only recognized writing outputs can replace a draft. Advice, outlines and checks remain advice.
export function applyWritingOutput(
  output: Payload,
  payload: Payload,
  platform: string,
): Payload | null {
  if (
    platform === "linkedin" &&
    typeof output.question === "string" &&
    Array.isArray(output.options)
  ) {
    return {
      ...payload,
      text: String(output.introductory_post ?? payload.text ?? ""),
      poll: {
        question: output.question,
        options: output.options,
        duration: "SEVEN_DAYS",
      },
    };
  }
  if (platform === "x" && Array.isArray(output.tweets))
    return { thread: output.tweets.map((text) => ({ text })) };
  if (
    Array.isArray(output.posts) &&
    ["x", "bluesky", "threads"].includes(platform)
  )
    return { thread: output.posts.map((text) => ({ text })) };
  if (platform === "reddit") {
    const body = output.rewritten_body ?? output.body ?? output.rewritten_text;
    if (typeof body === "string")
      return {
        ...payload,
        body:
          typeof output.transparency_statement === "string" &&
          !body.includes(output.transparency_statement)
            ? `${body}\n\n${output.transparency_statement}`
            : body,
        ...(typeof output.title === "string" ? { title: output.title } : {}),
        ...(output.post_type === "text" || output.post_type === "link"
          ? { post_type: output.post_type }
          : {}),
      };
  }
  for (const key of [
    "rewritten_text",
    "full_post",
    "compressed_post",
    "summary_post",
    "post",
    "content",
    "caption",
    "text",
  ]) {
    if (typeof output[key] === "string") {
      return Array.isArray(payload.thread)
        ? updateThread(payload, 0, { text: output[key] })
        : { ...payload, [profileFor(platform).textKey]: output[key] };
    }
  }
  const variants = output.variants ?? output.adapted_variants;
  if (variants && typeof variants === "object" && !Array.isArray(variants)) {
    const value = (variants as Payload)[platform];
    if (typeof value === "string")
      return { ...payload, [profileFor(platform).textKey]: value };
    if (value && typeof value === "object")
      return { ...payload, ...(value as Payload) };
  }
  return null;
}
