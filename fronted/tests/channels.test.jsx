import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CHANNELS, accountStatus, channelAccounts, connectionOptions, connectionSummary, filterChannels, isSafeAuthUrl, reconnectHint } from "../src/modules/channels/channel-config";
import ChannelCard from "../src/modules/channels/component/ChannelCard";
import ChannelsPanel from "../src/modules/channels/component/ChannelsPanel";

import AccountAvatar, { getAccountAvatarUrl } from "../src/modules/channels/component/AccountAvatar";

const accounts = [
  { id: "one", platform: "instagram", display_name: "Studio", status: "active", account_metadata: { profile_picture_url: "https://ig.com/pic.jpg" } },
  { id: "two", platform: "instagram", display_name: "Personal", status: "needs_reauth", account_metadata: {} },
  { id: "three", platform: "x", display_name: "Old account", status: "disabled", account_metadata: {} },
  { id: "four", platform: "bluesky", display_name: "Writer", status: "active", account_metadata: { handle: "writer.bsky.social", avatar: "https://bsky.social/avatar.png" } },
];
const noop = () => {};

describe("channel management", () => {
  test("counts live accounts and distinct channels without counting disabled connections", () => {
    expect(connectionSummary(accounts)).toEqual({ active: 2, platforms: 2, attention: 1 });
    expect(filterChannels(accounts, "connected", "").map((channel) => channel.id)).toEqual(["instagram", "bluesky"]);
    expect(filterChannels(accounts, "attention", "").map((channel) => channel.id)).toEqual(["instagram"]);
    expect(channelAccounts(accounts, "instagram").map((account) => account.id)).toEqual(["one", "two"]);
  });
  test("finds account names and channels across filters", () => {
    expect(filterChannels(accounts, "all", "  PERSONAL ").map((channel) => channel.id)).toEqual(["instagram"]);
    expect(filterChannels(accounts, "connected", "LinkedIn")).toEqual([]);
    expect(filterChannels([], "attention", "")).toEqual([]);
  });
  test("marks mixed active and expired accounts as needing attention", () => {
    const channel = CHANNELS.find((item) => item.id === "instagram");
    const html = renderToStaticMarkup(<ChannelCard channel={channel} accounts={channelAccounts(accounts, channel.id)} loading={false} onConnect={noop} onManage={noop} />);
    expect(html).toContain("Needs attention");
    expect(html).toContain("Manage Instagram accounts");
    expect(html).toContain("1 active account");
    expect(html).toContain("2 total");
    expect(html).toContain('role="switch"');
  });
  test("disabled accounts remain manageable without being shown as connected", () => {
    const html = renderToStaticMarkup(<ChannelCard channel={CHANNELS.find((item) => item.id === "x")} accounts={channelAccounts(accounts, "x")} loading={false} onConnect={noop} onManage={noop} />);
    expect(html).toContain("Turn on to connect");
    expect(html).not.toContain("Manage accounts");
    expect(accountStatus("disabled")).toBe("Disabled");
    expect(accountStatus("needs_reauth")).toBe("Reconnect needed");
  });
  test("renders profile picture when avatar_url is provided", () => {
    const accountWithPic = {
      id: "pic_acc",
      platform: "x",
      display_name: "Ajay Singh (@_itsajay___)",
      status: "active",
      avatar_url: "https://pbs.twimg.com/profile_images/2097081392567820288/7aE4e4vN_normal.jpg",
      account_metadata: {},
    };
    const html = renderToStaticMarkup(<AccountAvatar account={accountWithPic} />);
    expect(html).toContain('src="https://pbs.twimg.com/profile_images/2097081392567820288/7aE4e4vN_normal.jpg"');
    expect(html.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });
  test("extracts avatar from platform metadata across social methods", () => {
    expect(getAccountAvatarUrl({ id: "1", platform: "x", display_name: "X", status: "active", account_metadata: { profile_image_url: "https://x.com/a.jpg" } })).toBe("https://x.com/a.jpg");
    expect(getAccountAvatarUrl({ id: "2", platform: "linkedin", display_name: "LI", status: "active", account_metadata: { picture: "https://licdn.com/a.jpg" } })).toBe("https://licdn.com/a.jpg");
    expect(getAccountAvatarUrl({ id: "3", platform: "reddit", display_name: "R", status: "active", account_metadata: { icon_img: "https://reddit.com/a.png?w=256&amp;s=1" } })).toBe("https://reddit.com/a.png?w=256&s=1");
    expect(getAccountAvatarUrl({ id: "4", platform: "mastodon", display_name: "M", status: "active", account_metadata: { avatar: "https://mastodon.social/a.png" } })).toBe("https://mastodon.social/a.png");
    expect(getAccountAvatarUrl({ id: "5", platform: "facebook", display_name: "FB", status: "active", account_metadata: { picture: { data: { url: "https://fb.com/a.jpg" } } } })).toBe("https://fb.com/a.jpg");
    expect(getAccountAvatarUrl({ id: "6", platform: "instagram", display_name: "IG", status: "active", account_metadata: { instagram_accounts: [{ profile_picture_url: "https://ig.com/a.jpg" }] } })).toBe("https://ig.com/a.jpg");
    expect(getAccountAvatarUrl({ id: "7", platform: "threads", display_name: "TH", status: "active", account_metadata: { threads_profile_picture_url: "https://threads.net/a.jpg" } })).toBe("https://threads.net/a.jpg");
  });
  test("falls back to initials when account has no avatar", () => {
    const html = renderToStaticMarkup(<AccountAvatar account={{ id: "no_pic", platform: "x", display_name: "Ajay Singh", status: "active", account_metadata: {} }} />);
    expect(html).toContain("AJ");
    expect(html).not.toContain("<img");
  });
  test("unavailable channels have disabled actions", () => {
    for (const channelId of ["tiktok", "reddit"]) {
      const html = renderToStaticMarkup(<ChannelCard channel={CHANNELS.find((item) => item.id === channelId)} accounts={[]} loading={false} onConnect={noop} onManage={noop} />);
      expect(html).toContain("Coming soon");
      expect(html).toContain('disabled=""');
    }
  });
  test("account loading failure is an explicit error rather than a false empty state", () => {
    const html = renderToStaticMarkup(<ChannelsPanel accounts={[]} error="Connection unavailable" connectingPlatform={null} onRefresh={noop} onConnect={noop} onManage={noop} onAdd={noop} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn’t load your connections");
    expect(html).toContain("Connection unavailable");
    expect(html).not.toContain('aria-label="Connect Instagram"');
  });
});

describe("OAuth connection inputs", () => {
  test("allows secure redirects and local HTTP without permitting executable schemes", () => {
    for (const url of ["https://provider.example/oauth", "http://localhost:8000/oauth", "http://127.0.0.1/oauth"]) expect(isSafeAuthUrl(url)).toBe(true);
    for (const url of ["javascript:alert(1)", "file://localhost/etc", "ftp://localhost/foo", "http://provider.example/oauth", "not a URL"]) expect(isSafeAuthUrl(url)).toBe(false);
  });
  test("supplies the required discovery options and normalizes common pasted values", () => {
    expect(connectionOptions("bluesky", " @writer.bsky.social ")).toEqual({ identifier: "writer.bsky.social" });
    expect(connectionOptions("mastodon", "https://Mastodon.Social/")).toEqual({ instance_domain: "mastodon.social" });
    expect(connectionOptions("instagram", "")).toEqual({});
    expect(reconnectHint(accounts[3])).toBe("writer.bsky.social");
    expect(reconnectHint({ ...accounts[3], platform: "mastodon", account_metadata: { instance_domain: "hachyderm.io" } })).toBe("hachyderm.io");
  });
  test("rejects ambiguous provider identifiers before starting authorization", () => {
    for (const input of ["", "a handle", "https://bsky.app/profile/me", "me.bsky.social?x=1"]) expect(() => connectionOptions("bluesky", input)).toThrow();
    for (const input of ["", "http://mastodon.social", "mastodon.social/path", "user@mastodon.social", "mastodon.social:443"]) expect(() => connectionOptions("mastodon", input)).toThrow();
  });
});
