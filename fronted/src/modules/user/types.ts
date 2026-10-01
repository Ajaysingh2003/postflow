export type AuthUser = {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  workspace_id: string;
  // UI backwards compatibility:
  display_name?: string | null;
  email_verified_at?: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  workspace_id: string;
  user?: AuthUser;
  verification_required?: boolean;
  // Backwards compatibility:
  refresh_token?: string;
};

export type TokenResponse = AuthResponse;

export type RegisterResponse = AuthResponse & {
  user: AuthUser;
  verification_required: boolean;
};

export type MessageResponse = {
  message: string;
  development_token?: string | null;
  // Backwards compatibility:
  detail?: string;
};

export type AuthMessage = MessageResponse;

export type SessionResponse = {
  id: string;
  created_at: string;
  expires_at: string;
  current: boolean;
};

export type OAuthStartResponse = {
  provider: "google" | "github";
  url: string;
};

export type ApiKey = {
  id: string;
  key_id: string;
  name: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type CreatedApiKey = ApiKey & {
  secret: string;
};

export type Workspace = {
  id: string;
  name: string;
  isDefault?: boolean;
};

export type Plan = {
  name: string;
  projects_limit?: number | null;
  scans_per_month?: number | null;
  api_keys_limit?: number | null;
};

