"use client";
import { useState } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canEditMember, canManageTeam } from "./model";

type Role = "admin" | "editor" | "viewer" | "billing";
const roles: Role[] = ["editor", "admin", "viewer", "billing"];

function RoleSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as Role)}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={label}
        className="h-9 w-[116px] rounded-lg text-xs capitalize"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-lg">
        {roles.map((role) => (
          <SelectItem key={role} value={role} className="text-xs capitalize">
            {role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function TeamSettings() {
  const trpc = useTRPC();
  const client = useQueryClient();
  const { data: user } = useSuspenseQuery(trpc.user.me.queryOptions());
  const { data: workspace } = useSuspenseQuery(
    trpc.workspace.current.queryOptions(),
  );
  const { data: members } = useSuspenseQuery(
    trpc.workspace.members.queryOptions(),
  );
  const actor = members.find((member) => member.user_id === user.id)?.role;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const refresh = () => {
    void client.invalidateQueries({
      queryKey: trpc.workspace.members.queryKey(),
    });
  };
  const error = (err: { message: string }) => toast.error(err.message);

  const invite = useMutation(
    trpc.workspace.invite.mutationOptions({
      onSuccess: (data) => {
        setSent(data.email);
        setEmail("");
        toast.success("Invitation sent");
      },
      onError: error,
    }),
  );
  const update = useMutation(
    trpc.workspace.updateRole.mutationOptions({
      onSuccess: () => {
        refresh();
        toast.success("Role updated");
      },
      onError: error,
    }),
  );
  const remove = useMutation(
    trpc.workspace.removeMember.mutationOptions({
      onSuccess: () => {
        setRemoveId(null);
        refresh();
        toast.success("Member removed");
      },
      onError: error,
    }),
  );
  const pending = update.isPending || remove.isPending;

  return (
    <div className="space-y-7">
      <section>
        <h3 className="text-base font-semibold">{workspace.name}</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"} · Your
          role: <span className="capitalize">{actor}</span>
        </p>
      </section>

      {canManageTeam(actor) ? (
        <form
          className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSent(null);
            invite.mutate({ email: email.trim(), role });
          }}
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <UserPlus className="size-4" />
            Invite a teammate
          </h3>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Teammate email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="name@company.com"
              disabled={invite.isPending}
              className="h-9 min-w-0 flex-1 basis-48 rounded-lg"
            />
            <RoleSelect
              label="Invitation role"
              value={role}
              onChange={setRole}
              disabled={invite.isPending}
            />
          </div>
          <Button
            type="submit"
            className="primary-btn hover:text-white/80"
            disabled={invite.isPending || !email.trim()}
          >
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
          {sent && (
            <p role="status" className="break-all text-xs text-emerald-700">
              Invitation sent to {sent}.
            </p>
          )}
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only workspace owners and admins can manage the team.
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Members</h3>
        <div className="divide-y divide-border/60 rounded-xl border border-border/70">
          {members.map((member) => (
            <div key={member.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium">
                    {member.name || member.email}
                    {member.user_id === user.id && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        You
                      </span>
                    )}
                  </p>
                  <p className="mt-1 break-all text-[11px] text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                {canEditMember(
                  actor,
                  member.role,
                  member.user_id === user.id,
                ) ? (
                  <>
                    <RoleSelect
                      label={`Role for ${member.email}`}
                      value={member.role as Role}
                      disabled={pending}
                      onChange={(next) =>
                        update.mutate({
                          membershipId: member.id,
                          role: next,
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      className="!text-xs text-destructive"
                      disabled={pending}
                      onClick={() => setRemoveId(member.id)}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] capitalize">
                    {member.role}
                  </span>
                )}
              </div>
              {removeId === member.id && (
                <div className="mt-3 space-y-3 rounded-lg bg-destructive/5 p-3">
                  <p className="text-xs">
                    Remove {member.name || member.email} from this workspace?
                    They will lose access.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      className="primary-btn hover:text-white/80"
                      disabled={pending}
                      onClick={() => remove.mutate({ membershipId: member.id })}
                    >
                      {remove.isPending ? "Removing…" : "Confirm removal"}
                    </Button>
                    <Button
                      variant="outline"
                      className="secondary-btn"
                      disabled={pending}
                      onClick={() => setRemoveId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}