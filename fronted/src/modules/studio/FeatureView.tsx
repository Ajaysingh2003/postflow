"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  FileImage,
  Plug,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import {
  CHANNELS,
  channelName,
  type Account,
  type Feature,
  type Payload,
} from "./types";
import { button, input, panel, Loading, Notice, Status } from "./ui";

function Heading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Draftva workspace
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

export function Output({ value }: { value: unknown }) {
  if (value == null) return null;
  if (typeof value !== "object")
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {String(value)}
      </p>
    );
  if (Array.isArray(value))
    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div className="rounded-lg bg-muted/40 p-3" key={index}>
            <Output value={item} />
          </div>
        ))}
      </div>
    );
  return (
    <div className="space-y-4">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <h3 className="mb-1 text-xs font-medium capitalize text-muted-foreground">
            {key.replaceAll("_", " ")}
          </h3>
          <Output value={item} />
        </div>
      ))}
    </div>
  );
}

function Targets({
  account,
  value,
  setValue,
}: {
  account: Account;
  value: string;
  setValue: (value: string) => void;
}) {
  const trpc = useTRPC();
  const query = useQuery(trpc.studio.targets.queryOptions({ id: account.id }));
  return (
    <label className="block space-y-2 text-xs font-medium">
      <span>Publishing destination</span>
      <select
        className={input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="">Choose a destination</option>
        {query.data?.targets.map((target) => (
          <option value={target.id} key={target.id}>
            {target.name}
          </option>
        ))}
      </select>
      {query.error && <Notice message={query.error.message} />}
    </label>
  );
}

function MediaPicker({
  ids,
  onChange,
}: {
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const trpc = useTRPC();
  const query = useQuery(trpc.studio.resource.queryOptions({ kind: "media" }));
  const assets = Array.isArray(query.data)
    ? query.data.filter((asset) => asset.status === "ready")
    : [];
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Media attachments</p>
      {!assets.length ? (
        <p className="text-xs text-muted-foreground">
          Upload media in the{" "}
          <Link className="underline" href="/dashboard/content/media">
            media library
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {assets.map((asset) => (
            <label
              key={String(asset.id)}
              className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"
            >
              <input
                type="checkbox"
                checked={ids.includes(String(asset.id))}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...ids, String(asset.id)]
                      : ids.filter((id) => id !== asset.id),
                  )
                }
              />
              {String(asset.original_filename)}
            </label>
          ))}
        </div>
      )}
      {query.error && <Notice message={query.error.message} />}
    </div>
  );
}

export function ComposeView() {
  const trpc = useTRPC();
  const router = useRouter();
  const accounts = useQuery(trpc.studio.accounts.queryOptions());
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<string[]>([]);
  const create = useMutation(
    trpc.studio.create.mutationOptions({
      onSuccess: (post) => {
        toast.success("Draft saved");
        router.push(`/dashboard/posts/${post.id}`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  function payload(account: Account): Payload {
    if (account.platform === "reddit")
      return {
        title,
        body: text,
        subreddit: targets[account.id],
        post_type: "text",
      };
    if (account.platform === "instagram")
      return { caption: text, target_id: targets[account.id] };
    if (account.platform === "facebook")
      return { text, page_id: targets[account.id] };
    if (account.platform === "linkedin")
      return {
        text,
        ...(targets[account.id] ? { target_urn: targets[account.id] } : {}),
      };
    return { text };
  }
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
      <Heading
        title="New post"
        description="Create one draft with a variant for each selected account. Review, edit and schedule each channel separately."
      />
      <form
        className={panel + " space-y-5"}
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({
            title: title || "Untitled post",
            base_text: text,
            variants: (accounts.data ?? [])
              .filter((account) => selected.includes(account.id))
              .map((account) => ({
                platform: account.platform,
                connected_account_id: account.id,
                payload: payload(account),
                media_asset_ids: media,
              })),
          });
        }}
      >
        <label className="block space-y-2 text-xs font-medium">
          <span>Post title</span>
          <input
            className={input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={240}
            required
            placeholder="Give this post a name"
          />
        </label>
        <label className="block space-y-2 text-xs font-medium">
          <span>Draft text</span>
          <textarea
            className={input + " min-h-48"}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What would you like to share?"
          />
        </label>
        <div className="space-y-3">
          <h2 className="text-xs font-medium">Choose accounts</h2>
          {accounts.isPending ? (
            <Loading />
          ) : accounts.error ? (
            <Notice message={accounts.error.message} />
          ) : !accounts.data?.length ? (
            <Link href="/dashboard/channels" className={button}>
              <Plug className="size-4" />
              Connect your first account
            </Link>
          ) : (
            accounts.data.map((account) => (
              <div
                key={account.id}
                className="space-y-3 rounded-lg border border-border p-3"
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(account.id)}
                    disabled={account.status !== "active"}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, account.id]
                          : selected.filter((id) => id !== account.id),
                      )
                    }
                  />
                  <span>{account.display_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {channelName(account.platform)}
                  </span>
                  <Status value={account.status} />
                </label>
                {selected.includes(account.id) &&
                  ["reddit", "instagram", "facebook", "linkedin"].includes(
                    account.platform,
                  ) && (
                    <Targets
                      account={account}
                      value={targets[account.id] ?? ""}
                      setValue={(value) =>
                        setTargets({ ...targets, [account.id]: value })
                      }
                    />
                  )}
              </div>
            ))
          )}
        </div>
        <MediaPicker ids={media} onChange={setMedia} />
        <button
          className={button + " primary-btn"}
          disabled={!selected.length || create.isPending}
        >
          <Plus className="size-4" />
          {create.isPending ? "Saving…" : "Save draft & review"}
        </button>
      </form>
    </div>
  );
}

function AccountChannel({ platform }: { platform: (typeof CHANNELS)[number] }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.studio.accounts.queryOptions());
  const [identity, setIdentity] = useState("");
  const [manageReplies, setManageReplies] = useState(false);
  const connect = useMutation(
    trpc.studio.connect.mutationOptions({
      onSuccess: (result) => {
        const url = new URL(result.auth_url);
        if (url.protocol === "https:" || url.hostname === "localhost")
          window.location.assign(result.auth_url);
        else toast.error("The provider returned an invalid connection URL");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const disconnect = useMutation(
    trpc.studio.disconnect.mutationOptions({
      onSuccess: () => {
        toast.success("Account disconnected");
        void query.refetch();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const items =
    query.data?.filter((account) => account.platform === platform.id) ?? [];
  return (
    <section className={panel + " space-y-3"}>
      <h2 className="flex items-center gap-2 font-semibold">
        <span
          style={{ background: platform.color }}
          className="size-2 rounded-full"
        />
        {platform.label}
      </h2>
      {items.map((account) => (
        <div
          key={account.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3"
        >
          <div className="space-y-1">
            <p className="text-sm">{account.display_name}</p>
            <Status value={account.status} />
          </div>
          <button
            disabled={disconnect.isPending}
            className={button}
            onClick={() => {
              if (
                window.confirm(
                  `Disconnect ${account.display_name}? Scheduled posts on this account will stop.`,
                )
              )
                disconnect.mutate({ id: account.id });
            }}
          >
            Disconnect
          </button>
        </div>
      ))}
      {["mastodon", "bluesky"].includes(platform.id) && (
        <label className="block space-y-2 text-xs font-medium">
          <span>
            {platform.id === "mastodon" ? "Instance domain" : "Bluesky handle"}
          </span>
          <input
            className={input}
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            placeholder={
              platform.id === "mastodon"
                ? "mastodon.social"
                : "yourname.bsky.social"
            }
          />
        </label>
      )}
      {["reddit", "linkedin", "threads", "facebook", "instagram"].includes(
        platform.id,
      ) && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={manageReplies}
            onChange={(event) => setManageReplies(event.target.checked)}
          />
          Request post-management permissions
        </label>
      )}
      <button
        disabled={
          connect.isPending ||
          (["mastodon", "bluesky"].includes(platform.id) && !identity.trim())
        }
        className={button}
        onClick={() =>
          connect.mutate({
            platform: platform.id,
            options: {
              manage_replies: manageReplies,
              ...(platform.id === "mastodon"
                ? { instance_domain: identity.trim() }
                : platform.id === "bluesky"
                  ? { handle: identity.trim() }
                  : {}),
            },
          })
        }
      >
        <Plug className="size-3.5" />
        {items.length ? "Connect or reconnect" : "Connect account"}
      </button>
    </section>
  );
}

export function ChannelsView({ platform }: { platform?: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <Heading
        title={platform ? channelName(platform) : "Connected channels"}
        description="Connect accounts through each platform’s official authorization flow. Reconnect to grant newly approved permissions."
      />
      <div className="grid items-start gap-4 sm:grid-cols-2">
        {CHANNELS.filter((channel) => !platform || channel.id === platform).map(
          (channel) => (
            <AccountChannel key={channel.id} platform={channel} />
          ),
        )}
      </div>
    </div>
  );
}

function FeatureForm({ feature }: { feature: Feature }) {
  const trpc = useTRPC();
  const [platform, setPlatform] = useState(feature.platforms[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [accountId, setAccountId] = useState("");
  const accounts = useQuery(trpc.studio.accounts.queryOptions());
  const run = useMutation(
    trpc.studio.runFeature.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
  const properties = feature.input_schema.properties ?? {};
  function submit() {
    const data: Payload = {};
    for (const [name, property] of Object.entries(properties)) {
      const field =
        property.anyOf?.find((entry) => entry.type !== "null") ?? property;
      const raw = values[name];
      if (raw === undefined || !raw.trim()) {
        if (field.default !== undefined) data[name] = field.default;
        continue;
      }
      data[name] =
        field.type === "integer" || field.type === "number"
          ? Number(raw)
          : field.type === "boolean"
            ? raw === "true"
            : field.type === "array"
              ? raw
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
              : raw;
    }
    run.mutate({
      feature: feature.id,
      platform,
      connected_account_id: accountId || undefined,
      input_data: data,
    });
  }
  return (
    <div className="space-y-5">
      <Heading title={feature.name} description={feature.description} />
      <form
        className={panel + " space-y-4"}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="block space-y-2 text-xs font-medium">
          <span>Channel</span>
          <select
            className={input}
            value={platform}
            onChange={(event) => {
              setPlatform(event.target.value);
              setAccountId("");
            }}
          >
            {feature.platforms.map((value) => (
              <option value={value} key={value}>
                {channelName(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-xs font-medium">
          <span>Account context</span>
          <select
            className={input}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">No account selected</option>
            {accounts.data
              ?.filter((account) => account.platform === platform)
              .map((account) => (
                <option value={account.id} key={account.id}>
                  {account.display_name}
                </option>
              ))}
          </select>
        </label>
        {Object.entries(properties).map(([name, property]) => {
          const field =
            property.anyOf?.find((entry) => entry.type !== "null") ?? property;
          const value =
            values[name] ??
            (field.default == null ? "" : String(field.default));
          return (
            <label className="block space-y-2 text-xs font-medium" key={name}>
              <span>
                {property.title ?? name.replaceAll("_", " ")}
                {feature.input_schema.required?.includes(name) ? " *" : ""}
              </span>
              {field.type === "boolean" ? (
                <select
                  className={input}
                  value={value || "false"}
                  onChange={(event) =>
                    setValues({ ...values, [name]: event.target.value })
                  }
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <textarea
                  rows={
                    field.type === "integer" || field.type === "number" ? 1 : 3
                  }
                  className={input}
                  value={value}
                  required={feature.input_schema.required?.includes(name)}
                  placeholder={
                    field.type === "array"
                      ? "One item per line"
                      : property.description
                  }
                  onChange={(event) =>
                    setValues({ ...values, [name]: event.target.value })
                  }
                />
              )}
              {field.description && (
                <p className="font-normal text-muted-foreground">
                  {field.description}
                </p>
              )}
            </label>
          );
        })}
        <button disabled={run.isPending} className={button + " primary-btn"}>
          <Sparkles className="size-4" />
          {run.isPending ? "Writing…" : "Generate"}
        </button>
      </form>
      {run.error && <Notice message={run.error.message} />}
      {run.data && (
        <section className={panel}>
          <h2 className="mb-4 font-semibold">Generated result</h2>
          <Output value={run.data.output} />
        </section>
      )}
    </div>
  );
}

export function AssistantView({
  featureId,
  repurpose = false,
}: {
  featureId?: string;
  repurpose?: boolean;
}) {
  const trpc = useTRPC();
  const features = useQuery(trpc.studio.features.queryOptions());
  const [platform, setPlatform] = useState("");
  const selected = features.data?.find((feature) => feature.id === featureId);
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      {selected ? (
        <>
          <Link href="/dashboard/assistant" className={button}>
            All assistant features
          </Link>
          <FeatureForm key={selected.id} feature={selected} />
        </>
      ) : (
        <>
          <Heading
            title={repurpose ? "Repurpose & adapt" : "Assistant studio"}
            description="Choose a platform-specific writing feature. Generated content is checked against that channel’s publishing rules."
          />
          <select
            className={input}
            aria-label="Filter features by channel"
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
          >
            <option value="">All channels</option>
            {CHANNELS.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.label}
              </option>
            ))}
          </select>
          {features.isPending ? (
            <Loading />
          ) : features.error ? (
            <Notice message={features.error.message} />
          ) : featureId ? (
            <Notice message="This assistant feature is unavailable." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {features.data
                ?.filter(
                  (feature) =>
                    (!platform || feature.platforms.includes(platform)) &&
                    (!repurpose || /repurpose|adapt/.test(feature.id)),
                )
                .map((feature) => (
                  <Link
                    className={
                      panel + " block transition hover:border-violet-500/50"
                    }
                    key={feature.id}
                    href={`/dashboard/assistant/${feature.id}`}
                  >
                    <Sparkles className="mb-3 size-4 text-violet-500" />
                    <h2 className="text-sm font-semibold">{feature.name}</h2>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {feature.platforms.length === 8
                        ? "All channels"
                        : feature.platforms.map(channelName).join(" · ")}
                    </p>
                  </Link>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const RESOURCE_DETAILS = {
  templates: ["Templates", "Reusable starting points for your next post."],
  media: [
    "Media library",
    "Upload, scan and reuse files across your channel variants.",
  ],
  voices: [
    "Voice profiles",
    "Train a writing voice using your own sample posts.",
  ],
  runs: ["Assistant history", "Review past writing runs and their usage."],
  analytics: [
    "Analytics",
    "Latest cumulative performance for posts published in the last 30 days.",
  ],
  usage: ["Usage & limits", "Your current plan limits and usage."],
  members: ["Team & workspace", "Members with access to this workspace."],
} as const;

export function ResourceView({
  kind,
}: {
  kind: keyof typeof RESOURCE_DETAILS;
}) {
  const trpc = useTRPC();
  const query = useQuery(trpc.studio.resource.queryOptions({ kind }));
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const template = useMutation(
    trpc.studio.createTemplate.mutationOptions({
      onSuccess: () => {
        setName("");
        setText("");
        void query.refetch();
        toast.success("Template saved");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const voice = useMutation(
    trpc.studio.trainVoice.mutationOptions({
      onSuccess: () => {
        setText("");
        void query.refetch();
        toast.success("Voice profile trained");
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  async function upload(file: File) {
    setUploading(true);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("content_type", file.type || "application/octet-stream");
      data.set("purpose", "post");
      const response = await fetch("/api/media/attachments", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Upload failed");
      toast.success("File uploaded");
      void query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  const items = Array.isArray(query.data) ? query.data : [];
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
      <Heading
        title={RESOURCE_DETAILS[kind][0]}
        description={RESOURCE_DETAILS[kind][1]}
      />
      {kind === "media" && (
        <label className={button}>
          <Upload className="size-4" />
          {uploading ? "Uploading…" : "Upload media"}
          <input
            type="file"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      )}
      {(kind === "templates" || kind === "voices") && (
        <form
          className={panel + " space-y-3"}
          onSubmit={(event) => {
            event.preventDefault();
            if (kind === "templates")
              template.mutate({ name, base_text: text });
            else
              voice.mutate({
                tone_description: name,
                sample_posts: text
                  .split("\n---\n")
                  .filter((post) => post.trim()),
              });
          }}
        >
          <label className="block space-y-2 text-xs font-medium">
            <span>
              {kind === "templates" ? "Template name" : "Describe your tone"}
            </span>
            <input
              className={input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-2 text-xs font-medium">
            <span>
              {kind === "templates"
                ? "Template text"
                : "Sample posts (separate posts with a line containing ---)"}
            </span>
            <textarea
              className={input + " min-h-32"}
              value={text}
              onChange={(event) => setText(event.target.value)}
              required
            />
          </label>
          <button
            disabled={template.isPending || voice.isPending}
            className={button + " primary-btn"}
          >
            {kind === "templates" ? "Save template" : "Train voice"}
          </button>
        </form>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Notice message={query.error.message} />
      ) : Array.isArray(query.data) ? (
        !items.length ? (
          <Notice message="Nothing here yet. Your workspace items will appear here." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item, index) => (
              <article key={String(item.id ?? index)} className={panel}>
                {kind === "media" ? (
                  <>
                    <FileImage className="mb-3 size-5 text-muted-foreground" />
                    <h2 className="mb-2 text-sm font-medium">
                      {String(item.original_filename)}
                    </h2>
                    <Status value={String(item.status)} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {String(item.content_type)} ·{" "}
                      {Number(item.actual_size ?? 0).toLocaleString()} bytes
                    </p>
                    {item.status === "ready" && (
                      <a
                        className={button + " mt-3"}
                        href={`/api/media/${item.id}/content`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-3.5" />
                        View file
                      </a>
                    )}
                  </>
                ) : (
                  <Output
                    value={Object.fromEntries(
                      Object.entries(item).filter(
                        ([key]) =>
                          ![
                            "id",
                            "workspace_id",
                            "user_id",
                            "settings",
                            "variants",
                          ].includes(key),
                      ),
                    )}
                  />
                )}
              </article>
            ))}
          </div>
        )
      ) : (
        <div className={panel}>
          <Output value={query.data} />
        </div>
      )}
    </div>
  );
}

export function SettingsView({ profile = false }: { profile?: boolean }) {
  const trpc = useTRPC();
  const user = useQuery(trpc.user.me.queryOptions());
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
      <Heading
        title={profile ? "Your profile" : "Workspace settings"}
        description="Manage your account, workspace and plan."
      />
      <nav className="grid gap-3 sm:grid-cols-2">
        {[
          ["Your profile", "/dashboard/settings/profile"],
          ["Team & workspace", "/dashboard/settings/team"],
          ["Usage & limits", "/dashboard/settings/usage"],
          ["Billing", "/settings/billing"],
          ["Connected channels", "/dashboard/channels"],
        ].map(([label, href]) => (
          <Link className={panel} key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      {profile && (
        <div className={panel}>
          {user.isPending ? (
            <Loading />
          ) : user.error ? (
            <Notice message={user.error.message} />
          ) : (
            <>
              <h2 className="font-semibold">{user.data?.display_name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {user.data?.email}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HelpView() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
      <Heading
        title="Using postflow"
        description="Create, publish and manage your content across channels."
      />
      <div className={panel + " space-y-4"}>
        <h2 className="font-semibold">From draft to conversation</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>
            Connect an account under Channels using the official login flow.
          </li>
          <li>
            Create a post, attach media and choose a destination for each
            channel.
          </li>
          <li>
            Open the saved post to edit drafts, publish now or schedule a time.
          </li>
          <li>
            Published posts stay in Posts & Replies. Open a post to refresh
            comments, write a reply or edit/delete where the platform permits
            it.
          </li>
          <li>
            Use the activity log to review failures. An uncertain publishing or
            reply outcome must be checked on the original platform before
            retrying.
          </li>
        </ol>
        <Notice message="Some platforms require extra permissions or support management only on their own website. Each post shows the actions available for its connected account." />
      </div>
    </div>
  );
}
