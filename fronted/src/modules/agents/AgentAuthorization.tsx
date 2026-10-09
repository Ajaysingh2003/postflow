"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Plug, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AgentAuthorization({ request }: { request: string }) {
  const trpc = useTRPC();
  const authorization = useQuery(
    trpc.agents.authorization.queryOptions({ request }, { retry: false }),
  );
  const current = useQuery(trpc.workspace.current.queryOptions());
  const workspaces = useQuery(trpc.workspace.list.queryOptions());
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decision = useMutation(
    trpc.agents.decide.mutationOptions({
      onSuccess: (result) => {
        window.location.assign(result.redirect_url);
      },
      onError: (failure) => setError(failure.message),
    }),
  );
  const workspaceId = selected ?? current.data?.id;
  const pending =
    authorization.isPending || current.isPending || workspaces.isPending;
  const failure = authorization.error ?? current.error ?? workspaces.error;
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="rounded-2xl border border-border bg-popover p-7 shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[#7C5CFC]/10 text-[#7C5CFC]">
          <Plug className="size-6" />
        </span>
        <h1 className="mt-5 font-heading text-2xl">
          Connect your Postflow workspace
        </h1>
        {pending ? (
          <div
            role="status"
            aria-label="Loading connection request"
            className="mt-5 space-y-3"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : failure ? (
          <div role="alert" className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {failure.message}
            </p>
            <p className="text-xs text-muted-foreground">
              Return to your agent and start the connection again.
            </p>
            <Button asChild variant="outline" className="secondary-btn">
              <Link href="/dashboard">
                <ArrowLeft />
                Back to Postflow
              </Link>
            </Button>
          </div>
        ) : (
          authorization.data && (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                <strong className="text-foreground">
                  {authorization.data.client_name}
                </strong>{" "}
                is asking to connect. Approve access only if you started this
                request in that agent.
              </p>
              <p className="mt-2 break-all text-xs text-muted-foreground">
                You’ll return to {authorization.data.redirect_origin}.
              </p>
              <label className="mb-2 mt-6 block text-xs font-medium">
                Workspace
              </label>
              <Select
                value={workspaceId}
                onValueChange={(value) => value && setSelected(value)}
              >
                <SelectTrigger
                  aria-label="Workspace to connect"
                  className="w-full"
                >
                  <SelectValue>
                    {
                      workspaces.data?.find(
                        (workspace) => workspace.id === workspaceId,
                      )?.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workspaces.data?.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-5 rounded-xl border border-border p-4">
                <h2 className="text-xs font-semibold">Requested permissions</h2>
                <ul className="mt-3 space-y-3">
                  {Object.entries(authorization.data.scopes).map(
                    ([scope, text]) => (
                      <li
                        key={scope}
                        className="flex items-start gap-2 text-xs leading-relaxed"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                        {text}
                      </li>
                    ),
                  )}
                </ul>
              </div>
              <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                You can revoke this connection from Agents at any time. Social
                account credentials stay in Postflow.
              </p>
              {error && (
                <p role="alert" className="mt-4 text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="mt-6 flex gap-2">
                <Button
                  className="primary-btn flex-1"
                  disabled={decision.isPending || !workspaceId}
                  onClick={() =>
                    decision.mutate({
                      request,
                      approve: true,
                      workspace_id: workspaceId,
                    })
                  }
                >
                  {decision.isPending && <Loader2 className="animate-spin" />}
                  Approve connection
                </Button>
                <Button
                  variant="outline"
                  className="secondary-btn"
                  disabled={decision.isPending}
                  onClick={() =>
                    decision.mutate({
                      request,
                      approve: false,
                      workspace_id: workspaceId,
                    })
                  }
                >
                  Cancel
                </Button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
