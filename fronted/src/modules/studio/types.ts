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

export interface PostLibraryItem extends Variant {
  title: string;
  base_text: string;
}

export interface PostLibraryPage {
  items: PostLibraryItem[];
  counts: Record<"posts" | "scheduled" | "drafts", number>;
  total: number;
  next_offset: number | null;
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
  views: number;
  engagements: number;
  reach: number;
  clicks: number;
  latest_snapshot_at: string | null;
  extras: Payload;
}

export interface MetricSnapshotSummary {
  fetched_at: string;
  followers_count: number;
  profile_views: number;
  impressions: number;
  views: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares_reposts: number;
  clicks: number;
  extras: Payload;
}

export interface AnalyticsDashboard {
  cache_hit?: boolean;
  cache_expires_at?: string | null;
  refresh_available_at?: string | null;
  provider_reads?: number;
  daily_provider_reads?: number;
  daily_read_limit?: number;
  account_id: string | null;
  accounts: AccountAnalytics[];
  overview: WorkspaceOverview;
  posts: PostFeedItemAnalytics[];
  fetched_at: string;
  dataset_complete: boolean;
  dataset_notice: string | null;
  inclusive_impressions?: {
    total: number | null;
    post_impressions: number | null;
    reply_impressions: number | null;
    replies_count: number;
    complete: boolean;
  } | null;
  replies_supported?: boolean;
  replies_count?: number;
  feed_total?: number;
}

export interface AccountAnalytics {
  account_id: string;
  platform: string;
  display_name: string;
  account_type: string;
  followers_count: number;
  profile_views: number;
  impressions: number;
  views: number;
  reach: number;
  last_synced_at: string | null;
  historical_snapshots: MetricSnapshotSummary[];
  metrics_status?: "available" | "partial" | "unavailable";
  metrics_notice?: string | null;
  extras?: Payload | null;
}

export interface PlatformMetricsSummary {
  platform: string;
  impressions: number;
  views: number;
  reach: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  posts_count: number;
}

export interface WorkspaceOverview {
  total_impressions: number;
  total_views: number;
  total_reach: number;
  total_engagements: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_clicks: number;
  total_profile_clicks: number;
  total_bookmarks: number;
  total_posts_published: number;
  by_platform: Record<string, PlatformMetricsSummary>;
  timeframe_days: number;
  start_date: string | null;
  end_date: string | null;
  metrics_status?: "available" | "partial" | "unavailable";
  metrics_notice?: string | null;
  available_metrics?: string[] | null;
}

export interface PostFeedItemAnalytics {
  variant_id: string;
  post_id: string | null;
  platform: string;
  connected_account_id: string | null;
  account_display_name: string | null;
  text: string;
  media_urls: string[];
  published_at: string | null;
  created_at: string;
  status: string;
  external_post_id: string | null;
  external_url?: string | null;
  is_reply?: boolean;
  impressions: number;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  profile_clicks: number;
  bookmarks: number;
  engagements: number;
  engagement_rate: number;
  extras: Payload;
  metrics_status?: "available" | "partial" | "unavailable";
  metrics_notice?: string | null;
  available_metrics?: string[] | null;
  metrics_fetched_at: string | null;
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
