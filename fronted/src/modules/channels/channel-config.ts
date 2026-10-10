import type { Account, PlatformId } from "@/modules/studio/types";

export type ChannelConfig = {
  id: PlatformId | "tiktok";
  name: string;
  description: string;
  icon?: string;
  iconStyle: string;
  features: string[];
  comingSoon?: boolean;
};

export const CHANNELS: ChannelConfig[] = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Give your photos, carousels, and Reels a place to shine.",
    icon: "instagram.svg",
    iconStyle: "bg-rose-50 dark:bg-rose-950/30",
    features: ["Professional accounts", "Reels & carousels"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Share your expertise and build your professional presence.",
    icon: "linkedin.svg",
    iconStyle: "bg-sky-50 dark:bg-sky-950/30",
    features: ["Profiles & company pages", "Posts & articles"],
  },
  {
    id: "x",
    name: "X / Twitter",
    description:
      "Keep the conversation going with posts and thoughtful threads.",
    icon: "x.jpeg",
    iconStyle: "bg-neutral-100 dark:bg-neutral-800",
    features: ["Posts", "Threads"],
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Keep your community up to date with content for your Pages.",
    icon: "facebook.png",
    iconStyle: "bg-blue-50 dark:bg-blue-950/30",
    features: ["Pages", "Photos & videos"],
  },
  {
    id: "threads",
    name: "Threads",
    description: "Turn everyday thoughts into conversations worth joining.",
    icon: "threads.svg",
    iconStyle: "bg-neutral-100 dark:bg-neutral-800",
    features: ["Text posts", "Photos & videos"],
  },
  {
    id: "reddit",
    name: "Reddit",
    description: "Share something valuable with the communities that care.",
    icon: "reddit.svg",
    iconStyle: "bg-orange-50 dark:bg-orange-950/30",
    features: ["Subreddits", "Text & link posts"],
    comingSoon: true,
  },
  {
    id: "bluesky",
    name: "Bluesky",
    description: "Find your people with short posts and a fresh perspective.",
    iconStyle: "bg-sky-50 text-sky-500 dark:bg-sky-950/30",
    features: ["Posts & threads", "Rich text"],
  },
  // {
  //   id: "mastodon",
  //   name: "Mastodon",
  //   description: "Publish to your corner of the fediverse, on your terms.",
  //   iconStyle: "bg-violet-50 text-violet-500 dark:bg-violet-950/30",
  //   features: ["Your instance", "Content warnings"],
  // },
  {
    id: "tiktok",
    name: "TikTok",
    description: "A new home for your short-form stories. Stay tuned.",
    icon: "tiktok.svg",
    iconStyle: "bg-neutral-100 dark:bg-neutral-800",
    features: ["Short-form video"],
    comingSoon: true,
  },
];

export type ChannelFilter = "all" | "connected" | "attention";

export function channelAccounts(accounts: Account[], platform: string) {
  return accounts.filter((account) => account.platform === platform);
}

export function connectionSummary(accounts: Account[]) {
  const connected = accounts.filter((account) => account.status !== "disabled");
  return {
    active: accounts.filter((account) => account.status === "active").length,
    platforms: new Set(connected.map((account) => account.platform)).size,
    attention: accounts.filter((account) => account.status === "needs_reauth")
      .length,
  };
}

export function filterChannels(
  accounts: Account[],
  filter: ChannelFilter,
  search: string,
) {
  const term = search.trim().toLowerCase();
  return CHANNELS.filter((channel) => {
    const matches = channelAccounts(accounts, channel.id);
    const matchesFilter =
      filter === "all" ||
      (filter === "connected"
        ? matches.some((account) => account.status !== "disabled")
        : matches.some((account) => account.status === "needs_reauth"));
    return (
      matchesFilter &&
      `${channel.name} ${channel.description} ${matches.map((account) => account.display_name).join(" ")}`
        .toLowerCase()
        .includes(term)
    );
  });
}

export function accountStatus(status: string) {
  if (status === "active") return "Connected";
  if (status === "needs_reauth") return "Reconnect needed";
  if (status === "disabled") return "Disabled";
  return "Unavailable";
}

export function isSafeAuthUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

export function connectionOptions(
  platform: string,
  value: string,
): Record<string, string> {
  const input = value.trim();
  if (platform === "bluesky") {
    const identifier = input.replace(/^@/, "");
    if (!identifier.includes(".") || /[\s/?#@:]/.test(identifier))
      throw new Error("Enter your Bluesky handle, such as you.bsky.social.");
    return { identifier };
  }
  if (platform === "mastodon") {
    const domain = input.replace(/^https:\/\//i, "").replace(/\/$/, "");
    if (!domain.includes(".") || /[\s/?#@:]/.test(domain))
      throw new Error("Enter an instance domain, such as mastodon.social.");
    return { instance_domain: domain.toLowerCase() };
  }
  return {};
}

export function reconnectHint(account: Account) {
  const key = account.platform === "mastodon" ? "instance_domain" : "handle";
  const value = account.account_metadata?.[key];
  return typeof value === "string" ? value : "";
}
