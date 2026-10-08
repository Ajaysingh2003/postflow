export interface HomeAccount {
  id: string;
  platform: string;
  display_name: string;
  status: string;
}

export interface HomePost {
  post_id: string;
  variant_id: string | null;
  connected_account_id: string | null;
  platform: string | null;
  title: string;
  text: string;
  status: string;
  updated_at: string;
  scheduled_time: string | null;
  published_at: string | null;
  last_error: string | null;
}

export interface HomeSummary {
  workspace_id: string;
  workspace_name: string;
  fetched_at: string;
  can_edit: boolean;
  can_manage_channels: boolean;
  counts: Record<string, number>;
  accounts: HomeAccount[];
  drafts: HomePost[];
  upcoming: HomePost[];
  published: HomePost[];
  failed: HomePost[];
}

export const HOME_QUERY_OPTIONS = {
  staleTime: 30_000,
  refetchOnWindowFocus: true,
  refetchOnMount: true,
  retry: false,
} as const;

export function homePostLink(post: HomePost) {
  return `/dashboard/content?${new URLSearchParams({
    post: post.post_id,
    ...(post.variant_id ? { variant: post.variant_id } : {}),
    ...(post.connected_account_id
      ? { account: post.connected_account_id }
      : {}),
  })}`;
}

export function homePostTitle(post: HomePost) {
  return post.title && post.title !== "Untitled"
    ? post.title
    : post.text.trim().split("\n")[0] || "Untitled draft";
}

export function homePostTime(post: HomePost, now: string, timeZone: string) {
  if (post.status === "publishing") return "Publishing now";
  const value =
    post.status === "scheduled"
      ? post.scheduled_time
      : post.status === "published"
        ? (post.published_at ?? post.updated_at)
        : post.updated_at;
  if (!value || !Number.isFinite(Date.parse(value))) return "Time not set";
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  // CLDR punctuation differs between Node and browsers even for the same locale.
  const formatted = `${values.month} ${values.day} · ${values.hour}:${values.minute} ${values.dayPeriod}`;
  return post.status === "scheduled" && date.getTime() < Date.parse(now)
    ? `Overdue · ${formatted}`
    : formatted;
}

export function homeClock(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.hour}:${values.minute} ${values.dayPeriod}`;
}

export function homeFailureMessage(post: HomePost) {
  const error = (post.last_error ?? "").toLowerCase();
  if (/credits.depleted|payment required/.test(error))
    return "Your channel’s API credits have run out. Review this post before trying again.";
  if (/reconnect|unauthorized|expired|invalid.token/.test(error))
    return "Reconnect this channel before trying again.";
  if (/rate.limit|too many requests/.test(error))
    return "The channel is temporarily limiting requests. Review this post before retrying.";
  return "This post didn’t publish. Open it to review the issue.";
}

export function homeSetup(data: HomeSummary) {
  const connected = data.accounts.some((a) => a.status === "active");
  const written =
    data.counts.drafts +
      data.counts.scheduled +
      data.counts.published +
      data.counts.failed >
    0;
  const planned = data.counts.scheduled + data.counts.published > 0;
  return [
    {
      title: data.can_manage_channels
        ? "Connect a channel"
        : "View your channels",
      detail: "Bring your writing to your audience.",
      href: "/dashboard/channels",
      done: connected,
    },
    {
      title: data.can_edit ? "Write your first post" : "Explore your content",
      detail: "Start with an idea. Save it as a draft.",
      href: data.can_edit ? "/dashboard/content?new=1" : "/dashboard/content",
      done: written,
    },
    {
      title: data.can_edit ? "Choose its moment" : "Explore the schedule",
      detail: "Schedule a post for when it matters.",
      href: "/dashboard/schedule",
      done: planned,
    },
  ];
}
