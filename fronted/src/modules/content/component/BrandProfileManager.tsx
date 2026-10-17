"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsLink } from "@/modules/settings/SettingsProvider";
import { useTRPC } from "@/trpc/client";
import type { BrandProfile } from "../personaTypes";

export function BrandProfileManager({
  workspaceId,
  profile,
  disabled = false,
  compact = false,
  onUpgrade,
}: {
  workspaceId: string;
  profile: BrandProfile;
  disabled?: boolean;
  compact?: boolean;
  onUpgrade?: () => void;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const [action, setAction] = useState<"create" | "rename" | "delete" | null>(
    null,
  );
  const [name, setName] = useState("");
  const profiles = profile.profiles ?? [];
  const manage = useMutation(
    trpc.persona.manageBrand.mutationOptions({
      onSuccess: async (data, variables) => {
        cache.setQueryData(trpc.persona.brand.queryKey({ workspaceId }), data);
        await cache.invalidateQueries({
          queryKey: trpc.studio.resource.queryKey({ kind: "voices" }),
        });
        if (variables.action === "train") {
          void cache.invalidateQueries({
            queryKey: trpc.studio.billingUsage.queryKey({
              workspace_id: workspaceId,
            }),
          });
          void cache.invalidateQueries({
            queryKey: trpc.studio.usage.queryKey({ workspace_id: workspaceId }),
          });
        }
        setAction(null);
        setName("");
        toast.success(
          variables.action === "train"
            ? "Voice updated from your writing samples"
            : "Brand profile updated",
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const busy = disabled || manage.isPending;
  function submitAction() {
    if (!action || busy || (action !== "delete" && !name.trim())) return;
    manage.mutate({
      workspaceId,
      action,
      profileId: profile.id ?? undefined,
      name: action === "delete" ? undefined : name.trim(),
    });
  }
  if (profile.paid_access === false)
    return compact ? null : (
      <div className="mb-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <h3 className="text-sm font-semibold">
          Custom brand voices are a paid feature
        </h3>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Save different brands, add your best writing samples, and switch the
          voice used by your AI assistant. Free writing and publishing remain
          available within your plan limits.
        </p>
        <SettingsLink
          section="billing"
          onClick={onUpgrade}
          className="primary-btn mt-3 !text-xs"
        >
          View paid plans
        </SettingsLink>
      </div>
    );
  if (compact && profiles.length < 2) return null;
  const atLimit =
    profile.profile_limit != null && profiles.length >= profile.profile_limit;
  return (
    <div
      className={
        compact
          ? "max-w-40"
          : "mb-6 space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4"
      }
    >
      {!compact && (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Brand voices</h3>
          <span className="text-[11px] text-muted-foreground">
            {profiles.length} / {profile.profile_limit ?? "Unlimited"} saved
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Active brand voice"
          title={
            disabled
              ? "Save or discard your edits before switching profiles"
              : "Applies to the next AI request in this workspace"
          }
          value={profile.id ?? ""}
          disabled={busy || !profile.can_edit}
          onChange={(event) =>
            manage.mutate({
              workspaceId,
              action: "activate",
              profileId: event.target.value,
            })
          }
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs disabled:opacity-50"
        >
          {!profile.id && (
            <option value="" disabled>
              Choose a brand voice
            </option>
          )}
          {profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {!compact && (
          <Button
            type="button"
            variant="outline"
            className="secondary-btn !text-xs"
            disabled={busy || !profile.can_edit || atLimit}
            onClick={() => {
              setAction("create");
              setName("");
            }}
          >
            <Plus className="size-3.5" />
            New profile
          </Button>
        )}
      </div>
      {!compact && (
        <>
          <p className="text-[11px] leading-5 text-muted-foreground">
            {disabled
              ? "Save or discard your edits before managing profiles."
              : "The selected voice applies to the next AI request across this workspace."}
            {atLimit && " Your plan’s profile limit is reached."}
          </p>
          {profile.id && profile.can_edit && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="secondary-btn !text-xs"
                disabled={busy || !profile.sample_posts.length}
                title="Uses one AI credit. Save samples before training."
                onClick={() =>
                  manage.mutate({
                    workspaceId,
                    action: "train",
                    profileId: profile.id!,
                    expectedUpdatedAt: profile.updated_at,
                  })
                }
              >
                <Sparkles className="size-3.5" />
                {manage.isPending && manage.variables?.action === "train"
                  ? "Learning your voice…"
                  : "Learn from saved samples · 1 credit"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="!text-xs"
                disabled={busy}
                onClick={() => {
                  setAction("rename");
                  setName(profile.profile_name ?? "");
                }}
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="ghost"
                aria-label="Delete selected brand profile"
                className="!text-xs text-destructive"
                disabled={busy}
                onClick={() => setAction("delete")}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          )}
          {action && (
            <div
              role="group"
              aria-label="Manage brand profile"
              className="space-y-3 rounded-lg border border-border/70 bg-background p-3"
            >
              {action === "delete" ? (
                <p className="text-xs leading-5">
                  Delete “{profile.profile_name}” and its saved voice details?
                  This cannot be undone. Your posts will be kept.
                </p>
              ) : (
                <label className="block text-xs font-medium">
                  {action === "create" ? "New profile name" : "Profile name"}
                  <Input
                    aria-label="Brand profile name"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        submitAction();
                      }
                    }}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={120}
                    className="mt-2"
                    placeholder="e.g. Personal brand or Studio"
                    autoFocus
                  />
                </label>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={submitAction}
                  className="primary-btn !text-xs"
                  disabled={busy || (action !== "delete" && !name.trim())}
                >
                  {manage.isPending
                    ? "Saving…"
                    : action === "delete"
                      ? "Confirm deletion"
                      : action === "create"
                        ? "Create profile"
                        : "Save name"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="secondary-btn !text-xs"
                  disabled={manage.isPending}
                  onClick={() => setAction(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
