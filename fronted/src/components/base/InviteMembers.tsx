"use client";

import React, { useMemo, useState } from "react";
import {
  Check,
  CreditCard,
  Eye,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

import WorkspaceDialog from "./WorkspaceDialog";

export type MemberRole = "editor" | "admin" | "viewer" | "billing" | "member";

interface InviteMember {
  id: string;
  email: string;
  role: MemberRole;
}

interface InviteMemberBoxProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  isPending?: boolean;
}

const createInvite = (): InviteMember => ({
  id: crypto.randomUUID(),
  email: "",
  role: "editor",
});

export function InviteMemberBox({
  open,
  setOpen,
  isPending = false,
}: InviteMemberBoxProps) {
  const trpc = useTRPC();
  const [invites, setInvites] = useState<InviteMember[]>([createInvite()]);

  const validInvites = useMemo(
    () => invites.filter((invite) => invite.email.trim()),
    [invites],
  );

  const addInvite = () => {
    setInvites((prev) => [...prev, createInvite()]);
  };

  const removeInvite = (id: string) => {
    setInvites((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], email: "" }];
      }
      return prev.filter((invite) => invite.id !== id);
    });
  };

  const updateEmail = (id: string, email: string) => {
    setInvites((prev) =>
      prev.map((invite) => (invite.id === id ? { ...invite, email } : invite)),
    );
  };

  const updateRole = (id: string, role: MemberRole) => {
    setInvites((prev) =>
      prev.map((invite) => (invite.id === id ? { ...invite, role } : invite)),
    );
  };

  const queryClient = useQueryClient();

  const bulkInviteMutation = useMutation(
    trpc.workspace.bulkInvite.mutationOptions({
      onSuccess: async (data) => {
        toast.success(
          data.length > 1
            ? `${data.length} invitations sent successfully!`
            : "Invitation sent successfully!",
        );
        await queryClient.invalidateQueries({
          queryKey: trpc.workspace.current.queryKey(),
        });
        setInvites([createInvite()]);
        setOpen(false);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to send invitations");
      },
    }),
  );

  const handleInviteMembers = () => {
    if (!validInvites.length) return;

    const payload = validInvites.map(({ email, role }) => ({
      email: email.trim(),
      role: (role === "member" ? "editor" : role) as "admin" | "editor" | "viewer" | "billing",
    }));

    bulkInviteMutation.mutate({ invitations: payload });
  };

  return (
    <WorkspaceDialog
      handleSubmit={handleInviteMembers}
      isPending={isPending || bulkInviteMutation.isPending}
      label="Invite team members"
      btnLabel={
        bulkInviteMutation.isPending
          ? "Sending..."
          : validInvites.length > 1
            ? `Send ${validInvites.length} invitations`
            : "Send invitation"
      }
      open={open}
      setOpen={setOpen}
    >
      <div className="space-y-4 py-1">
        {/* Header Section */}
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 shadow-2xs">
            <Users className="size-4 text-neutral-700" />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-semibold leading-tight text-neutral-900">
              Add people to your workspace
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              Invite teammates to collaborate in real-time. Choose their default
              permissions below.
            </p>
          </div>
        </div>

        {/* Input Table Form */}
        <div className="rounded-xl border border-neutral-200/90 bg-neutral-50/50 p-2.5">
          {/* Column Header Titles */}
          <div className="mb-2 grid grid-cols-[1fr_130px_36px] items-center gap-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Email Address
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Role
            </span>
            <span className="sr-only">Actions</span>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {invites.map((invite, index) => {
              const canDelete = invites.length > 1 || invite.email.length > 0;

              return (
                <div
                  key={invite.id}
                  className="group grid grid-cols-[1fr_130px_36px] items-center gap-2"
                >
                  {/* Email Input */}
                  <div className="relative">
                    <Input
                      type="email"
                      value={invite.email}
                      onChange={(e) => updateEmail(invite.id, e.target.value)}
                      placeholder={
                        index === 0
                          ? "alex@company.com"
                          : "teammate@company.com"
                      }
                      className="h-9 rounded-lg border border-neutral-200 text-xs shadow-2xs autoFocus"
                      autoFocus={index === 0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (invite.email.trim()) addInvite();
                        }
                      }}
                    />
                  </div>

                  {/* Role Selector */}
                  <Select
                    value={invite.role}
                    onValueChange={(val) => {
                      if (val) updateRole(invite.id, val as MemberRole);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full rounded-lg border-neutral-200 bg-white px-2.5 text-xs shadow-none focus:border-[#22b2f8] focus:ring-2 focus:ring-[#22b2f8]/15">
                      <div className="flex items-center gap-1.5 truncate">
                        {invite.role === "admin" ? (
                          <Shield className="size-3 text-sky-600 shrink-0" />
                        ) : invite.role === "viewer" ? (
                          <Eye className="size-3 text-amber-600 shrink-0" />
                        ) : invite.role === "billing" ? (
                          <CreditCard className="size-3 text-purple-600 shrink-0" />
                        ) : (
                          <UserRound className="size-3 text-neutral-500 shrink-0" />
                        )}
                        <span className="capitalize font-medium text-neutral-800">
                          <SelectValue />
                        </span>
                      </div>
                    </SelectTrigger>

                    <SelectContent
                      align="start"
                      className="w-[240px] rounded-xl border-neutral-200 p-1 shadow-xl"
                    >
                      <SelectItem
                        value="editor"
                        className="cursor-pointer rounded-lg py-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-neutral-100">
                            <UserRound className="size-3 text-neutral-600" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-medium text-neutral-900">
                              Editor
                            </p>
                            <p className="text-[10px] text-neutral-500 leading-tight">
                              Can build & manage content, campaigns & prospects.
                            </p>
                          </div>
                        </div>
                      </SelectItem>

                      <SelectItem
                        value="admin"
                        className="cursor-pointer rounded-lg py-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600">
                            <Shield className="size-3" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-medium text-neutral-900">
                              Admin
                            </p>
                            <p className="text-[10px] text-neutral-500 leading-tight">
                              Full access to workspace settings & billing.
                            </p>
                          </div>
                        </div>
                      </SelectItem>

                      <SelectItem
                        value="viewer"
                        className="cursor-pointer rounded-lg py-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600">
                            <Eye className="size-3" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-medium text-neutral-900">
                              Viewer
                            </p>
                            <p className="text-[10px] text-neutral-500 leading-tight">
                              Read-only access to content, drafts & analytics.
                            </p>
                          </div>
                        </div>
                      </SelectItem>

                      <SelectItem
                        value="billing"
                        className="cursor-pointer rounded-lg py-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-purple-50 text-purple-600">
                            <CreditCard className="size-3" />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-medium text-neutral-900">
                              Billing
                            </p>
                            <p className="text-[10px] text-neutral-500 leading-tight">
                              Manage subscription plans, invoices & payments.
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Remove Button */}
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={!canDelete}
                      onClick={() => removeInvite(invite.id)}
                      className={cn(
                        "size-9 rounded-lg text-neutral-400 transition-colors",
                        canDelete
                          ? "hover:bg-red-50 hover:text-red-600 opacity-60 group-hover:opacity-100"
                          : "opacity-0 pointer-events-none",
                      )}
                      title="Remove row"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Row Button */}
          <button
            type="button"
            onClick={addInvite}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300/80 bg-white/70 text-[11px] font-medium text-neutral-600 transition-colors hover:border-[#22b2f8]/60 hover:bg-sky-50/40 hover:text-[#0284c7]"
          >
            <Plus className="size-3.5" />
            <span>Add another person</span>
          </button>
        </div>

        {/* Live Invite Counter Strip */}
        {validInvites.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white px-3 py-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <Check className="size-3 stroke-[2.5]" />
              </div>
              <span className="text-[11px] font-medium text-neutral-700">
                {validInvites.length}{" "}
                {validInvites.length === 1 ? "invitation" : "invitations"} ready
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5  text-[10px] text-neutral-500">
              {validInvites.filter((i) => i.role === "editor" || i.role === "member").length > 0 && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                  {validInvites.filter((i) => i.role === "editor" || i.role === "member").length} Editor
                </span>
              )}
              {validInvites.filter((i) => i.role === "admin").length > 0 && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                  {validInvites.filter((i) => i.role === "admin").length} Admin
                </span>
              )}
              {validInvites.filter((i) => i.role === "viewer").length > 0 && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                  {validInvites.filter((i) => i.role === "viewer").length} Viewer
                </span>
              )}
              {validInvites.filter((i) => i.role === "billing").length > 0 && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5">
                  {validInvites.filter((i) => i.role === "billing").length} Billing
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </WorkspaceDialog>
  );
}
