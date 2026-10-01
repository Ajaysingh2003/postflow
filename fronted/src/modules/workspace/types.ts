export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | "billing";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type WorkspaceMember = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: WorkspaceRole | string;
};

export type WorkspaceInvitation = {
  id: string;
  email: string;
  role: WorkspaceRole | string;
  expires_at: string;
  development_token?: string | null;
};
