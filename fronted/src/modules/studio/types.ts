export type Payload = Record<string, unknown>;

export interface Variant {
  id: string;
  post_id: string;
  platform: string;
  connected_account_id: string | null;
  payload: Payload;
  status: string;
  scheduled_time: string | null;
  published_at: string | null;
  external_post_id: string | null;
  last_error: string | null;
  publish_state: Payload;
  media_asset_ids: string[];
  updated_at: string;
}

export interface Post {
  id: string;
  title: string;
  base_text: string;
  status: string;
  created_at: string;
  updated_at: string;
  variants: Variant[];
}

export interface Account {
  id: string;
  platform: string;
  display_name: string;
  status: string;
  account_metadata: Payload;
  account_type?: string;
  external_account_id?: string;
  granted_scopes?: string[];
  token_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  avatar_url?: string | null;
}

export interface PostActions {
  can_read_replies: boolean;
  can_reply: boolean;
  reply_requires_parent: boolean;
  can_edit: boolean;
  can_delete: boolean;
  edit_field: string;
  max_reply_length: number;
  external_url: string | null;
  notices: string[];
}

export interface Reply {
  id: string;
  author: string;
  text: string;
  created_at: string | null;
  target_token: string;
}

export interface RepliesPage {
  items: Reply[];
  next_cursor: string | null;
  notice: string | null;
}

export interface InputField {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  anyOf?: InputField[];
  items?: InputField;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

export interface SubredditProfile {
  name: string;
  rules: { short_name: string; description: string }[];
  allowed_post_types: string[];
  flair_required: boolean;
  available_flairs: { id: string; text: string }[];
  title_requirements: Payload;
  fetched_at: string;
}

export interface ValidationResult {
  is_valid: boolean;
  issues: { field: string; message: string; severity: string }[];
}

export interface VariantMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  engagements: number;
  reach: number;
  clicks: number;
  latest_snapshot_at: string | null;
  extras: Payload;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  input_schema: {
    properties?: Record<string, InputField>;
    required?: string[];
  };
}

export function variantText(variant: Variant): string {
  for (const key of ["text", "caption", "body"]) {
    if (typeof variant.payload[key] === "string")
      return variant.payload[key] as string;
  }
  return "";
}

export type PlatformId =
  | "x"
  | "linkedin"
  | "reddit"
  | "bluesky"
  | "mastodon"
  | "facebook"
  | "instagram"
  | "threads";

export interface ChannelMeta {
  id: PlatformId;
  label: string;
  color: string;
}

export const CHANNELS: ChannelMeta[] = [
  { id: "x", label: "X (Twitter)", color: "#000000" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { id: "reddit", label: "Reddit", color: "#FF4500" },
  { id: "bluesky", label: "Bluesky", color: "#0285FF" },
  { id: "mastodon", label: "Mastodon", color: "#6364FF" },
  { id: "facebook", label: "Facebook", color: "#1877F2" },
  { id: "instagram", label: "Instagram", color: "#E4405F" },
  { id: "threads", label: "Threads", color: "#000000" },
];

export function channelName(platform: string) {
  return CHANNELS.find((channel) => channel.id === platform)?.label ?? platform;
}
