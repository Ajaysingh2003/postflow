"use client";

import React, { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  LucideLogOut,
  Plus,
  Settings,
  SettingsIcon,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { useSidebar } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GenerateAvatar from "@/modules/user/component/GenerateAvartar";
import { cn } from "@/lib/utils";
import WorkspaceDialog from "./WorkspaceDialog";
import { Input } from "../ui/input";
import { InviteMemberBox } from "./InviteMembers";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

interface ProfileType {
  email: string;
  role?: string;
  isActive?: boolean;
}

export function ProfileMenuSkeleton() {
  const sidebar = useSidebar();
  return (
    <div className="flex h-12 w-full items-center justify-between gap-2.5 rounded-xl py-1.5 text-xs">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="size-8 shrink-0 rounded-xl bg-neutral-200 dark:bg-white/10 animate-pulse" />
        {sidebar.open && (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
            <div className="h-3.5 w-24 rounded bg-neutral-200 dark:bg-white/10 animate-pulse" />
            <div className="h-2.5 w-28 rounded bg-neutral-200 dark:bg-white/10 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileMenuContent() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [hoverWorkspace, setHoverWorkspace] = useState<string>("");

  const [openInvite, setOpenInvite] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const sidebar = useSidebar();
  const trpc = useTRPC();

  // Queries
  const { data: profile } = useSuspenseQuery(trpc.user.profile.queryOptions());
  const { data: workspaces } = useSuspenseQuery(trpc.workspace.list.queryOptions());
  const { data: currentWorkspace } = useSuspenseQuery(
    trpc.workspace.current.queryOptions(),
  );

  const profileData = profile as ProfileType;
  const workspacesList = (workspaces as Workspace[]) || [];
  const activeWorkspace = currentWorkspace as Workspace;

  // Mutations
  const switchWorkspace = useMutation(
    trpc.workspace.switch.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        window.location.reload();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to switch workspace");
      },
    }),
  );

  const createWorkspace = useMutation(
    trpc.workspace.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Workspace created successfully.");
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.workspace.current.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.workspace.list.queryKey(),
          }),
        ]);
        setWorkspaceName("");
        setDialogOpen(false);
        setMenuOpen(false);
        queryClient.clear();
        window.location.reload();
      },
      onError: (err) => {
        toast.error(err.message || "Failed to create workspace");
      },
    }),
  );

  const handleCreateSubmit = async () => {
    if (!workspaceName.trim()) {
      toast.error("Please enter a workspace name.");
      return;
    }
    await createWorkspace.mutateAsync({ name: workspaceName.trim() });
  };

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id) return;
    await switchWorkspace.mutateAsync({ workspaceId });
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          type="button"
          className="flex h-12 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl py-1.5 text-xs text-neutral-900 transition-colors hover:bg-black/5 focus:outline-none focus-visible:outline-none"
        >
          <div className="flex min-w-0  items-center gap-2.5">
            <GenerateAvatar
              isCircle={true}
              className="size-8 shrink-0 rounded-xl  shadow-2xs"
              seed={profileData?.email || "user"}
              variant="initials"
            />

            {sidebar.open && (
              <div className="flex min-w-0 flex-1 flex-col text-left">
                <h3 className="truncate font-semibold text-[13px] leading-tight text-neutral-900">
                  {profileData?.email}
                </h3>
                <p className="truncate text-[11px] leading-tight text-neutral-500">
                  {activeWorkspace?.name || "Personal Workspace"}
                </p>
              </div>
            )}
          </div>

          {sidebar.open && (
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-neutral-400 transition-transform duration-200",
                menuOpen && "rotate-180 text-neutral-700",
              )}
            />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className="w-56 rounded-2xl border border-black/[0.08] bg-white p-2 text-neutral-600 shadow-xl outline-none"
          align="start"
          sideOffset={8}
        >
          {/* Header Card */}
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <GenerateAvatar
              isCircle={false}
              className="size-9 shrink-0 rounded-xl  shadow-2xs"
              seed={profileData?.email || "user"}
              variant="initials"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold text-[13px] leading-tight text-neutral-900">
                {profileData?.email}
              </span>
              <span className="text-[11px] text-neutral-400">Free Plan</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-2 grid grid-cols-2 gap-1.5 px-1 text-xs">
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-neutral-50 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:outline-none"
            >
              <Settings className="size-3.5 text-neutral-500" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => setOpenInvite(true)}
              className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border bg-neutral-50 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 focus:bg-neutral-100 focus:outline-none"
            >
              <UserPlus className="size-3.5 text-neutral-500" />
              Invite
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="my-2 bg-neutral-100" />

          {/* Workspaces Label */}
          <p className="px-2 py-1  text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Workspaces
          </p>

          {/* Workspaces List */}
          <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto pr-0.5">
            {workspacesList.map((workspace) => {
              const isActive = workspace.id === activeWorkspace?.id;
              const isHovered = hoverWorkspace === workspace.id;

              return (
                <DropdownMenuItem
                  key={workspace.id}
                  onPointerEnter={() => setHoverWorkspace(workspace.id)}
                  onPointerLeave={() => setHoverWorkspace("")}
                  onClick={() => handleSwitch(workspace.id)}
                  className={cn(
                    "flex  cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-neutral-100/70 focus:bg-neutral-100/70 focus:outline-none",
                    isActive && "bg-neutral-50 text-neutral-950 font-medium",
                  )}
                >
                  <GenerateAvatar
                    isCircle={false}
                    className="size-5 shrink-0 rounded-md "
                    seed={workspace.name}
                    variant="initials"
                  />

                  <span className="min-w-0 flex-1 truncate text-[12px] capitalize text-neutral-800">
                    {workspace.name}
                  </span>

                  <div className="flex size-4 shrink-0 items-center justify-center">
                    {isActive ? (
                      isHovered ? (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/workspace/${workspace.slug}/settings`,
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              router.push(
                                `/workspace/${workspace.slug}/settings`,
                              );
                            }
                          }}
                          className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700 transition-colors"
                          title="Workspace Settings"
                        >
                          <SettingsIcon className="size-3.5" />
                        </div>
                      ) : (
                        <Check className="size-3.5 stroke-[2.5] text-sky-600" />
                      )
                    ) : null}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>

          <DropdownMenuSeparator className="my-2 bg-neutral-100" />

          {/* Create Workspace Trigger */}
          <DropdownMenuItem
            onClick={() => setDialogOpen(true)}
            className="flex cursor-pointer mt-2 items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-neutral-800 hover:bg-neutral-100/70 focus:bg-neutral-100/70 focus:outline-none"
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
              <Plus className="size-3 text-neutral-600" strokeWidth={2.5} />
            </div>
            <span className="truncate">Create Workspace</span>
          </DropdownMenuItem>

          {/* Logout Action */}
          <DropdownMenuItem
            onClick={() => router.push("/api/auth/signout")}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive focus:outline-none"
          >
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-destructive/20 bg-destructive/5">
              <LucideLogOut className="size-3" strokeWidth={2.5} />
            </div>
            <span className="truncate">Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Standalone Create Workspace Dialog */}

      <WorkspaceDialog
        handleSubmit={handleCreateSubmit}
        isPending={createWorkspace.isPending}
        label="Create Workspace"
        btnLabel="create"
        open={dialogOpen}
        setOpen={setDialogOpen}
      >
        <div>
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. Acme Marketing, Personal"
            className="h-10 rounded-xl border border-neutral-200 text-xs shadow-2xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateSubmit();
              }
            }}
          />
        </div>
      </WorkspaceDialog>

      <InviteMemberBox open={openInvite} setOpen={setOpenInvite} />
    </>
  );
}

export default function ProfileMenu() {
  return (
    <Suspense fallback={<ProfileMenuSkeleton />}>
      <ProfileMenuContent />
    </Suspense>
  );
}
