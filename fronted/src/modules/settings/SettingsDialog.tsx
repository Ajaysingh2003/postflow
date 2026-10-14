"use client";
import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import {
  QueryErrorResetBoundary,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { CreditCard, ShieldCheck, UserRound, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { SettingsBoundary, SettingsSkeleton } from "./SettingsBoundary";
import { ProfileSettings, SecuritySettings } from "./AccountSettings";
import type { SettingsSection } from "./model";

const BillingView = dynamic(
  () => import("@/modules/billing/component/BillingView"),
  { loading: SettingsSkeleton },
);
const TeamSettings = dynamic(() => import("./TeamSettings"), {
  loading: SettingsSkeleton,
});
const ChannelsView = dynamic(
  () => import("@/modules/channels/view/ChannelsView"),
  { loading: SettingsSkeleton },
);
const AgentsSettings = dynamic(
  () =>
    import("@/modules/agents/AgentsDialog").then(
      (module) => module.EmbeddedAgentsSettings,
    ),
  { loading: SettingsSkeleton },
);

export const SETTING_ITEMS = [
  {
    id: "profile",
    label: "Your profile",
    description: "Your name and account details.",
    icon: UserRound,
    group: "Account",
  },
  {
    id: "security",
    label: "Security",
    description: "Password and signed-in sessions.",
    icon: ShieldCheck,
    group: "Account",
  },
  {
    id: "billing",
    label: "Billing",
    description: "Your workspace plan and monthly usage.",
    icon: CreditCard,
    group: "Workspace",
  },
  {
    id: "team",
    label: "Team & workspace",
    description: "People, invitations and permissions.",
    icon: Users,
    group: "Workspace",
  },
] as const;

function SettingsContent({
  section,
  onDirty,
}: {
  section: SettingsSection;
  onDirty: (dirty: boolean) => void;
}) {
  const trpc = useTRPC();
  const { data: workspace } = useSuspenseQuery(
    trpc.workspace.current.queryOptions(),
  );

  if (section === "billing")
    return (
      <BillingView key={workspace.id} workspaceId={workspace.id} embedded />
    );
  if (section === "team") return <TeamSettings key={workspace.id} />;
  if (section === "channels") return <ChannelsView compact />;
  if (section === "agents") return <AgentsSettings key={workspace.id} />;
  if (section === "security") return <SecuritySettings />;
  return <ProfileSettings onDirty={onDirty} />;
}

export default function SettingsDialog({
  section,
  onSelect,
  onClose,
}: {
  section: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState<{
    section: SettingsSection | null;
  } | null>(null);

  function go(next: SettingsSection | null) {
    if (next === section) return;
    if (dirty) {
      setDiscard({ section: next });
      return;
    }
    if (next) onSelect(next);
    else onClose();
  }

  // Sections without a sidebar entry (channels, agents) fall back to the first
  // item for the header instead of crashing on an undefined lookup.
  const selected =
    SETTING_ITEMS.find((item) => item.id === section) ?? SETTING_ITEMS[0];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) go(null);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(760px,90svh)] w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-background p-0 shadow-2xl sm:max-w-[980px] sm:flex-row"
      >
        <aside className="flex shrink-0 flex-col border-b border-border/60 bg-muted/20 p-3 sm:w-[236px] sm:border-b-0 sm:border-r sm:p-4">
          <p className="mb-3 flex items-baseline gap-2 px-2 pt-1 text-sm font-semibold tracking-tight">
            Settings
            <span className="text-[11px] font-normal text-muted-foreground">
              Draftva
            </span>
          </p>

          <nav
            aria-label="Settings sections"
            className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-col sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            {SETTING_ITEMS.map((item, index) => {
              const active = section === item.id;
              const startsGroup =
                index === 0 || SETTING_ITEMS[index - 1].group !== item.group;

              return (
                <div key={item.id} className="shrink-0">
                  {startsGroup && (
                    <p className="mb-1.5 mt-5 hidden px-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80 first:mt-2 sm:block">
                      {item.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => go(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-[13px] text-muted-foreground transition-colors",
                      "hover:bg-foreground/5 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active &&
                        "bg-background font-medium text-foreground shadow-xs ring-1 ring-border/60",
                    )}
                  >
                    <item.icon
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active && "text-violet-500",
                      )}
                    />
                    {item.label}
                  </button>
                </div>
              );
            })}
          </nav>

          <p className="mt-auto hidden border-t border-border/60 px-2.5 pt-4 text-[11px] leading-5 text-muted-foreground sm:block">
            Account settings are yours.
            <br />
            Workspace settings are shared with your team.
          </p>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-5 py-5 sm:px-8 sm:py-6">
            <div className="min-w-0">
              <DialogTitle className="font-heading text-2xl font-semibold tracking-tight">
                {selected.label}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[13px] text-muted-foreground">
                {selected.description}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close settings"
              className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => go(null)}
            >
              <X className="size-4" />
            </Button>
          </header>

          {discard && (
            <div
              role="alert"
              className="flex flex-col gap-3 border-b border-amber-500/20 bg-amber-500/5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-8"
            >
              <p className="flex items-center gap-2 text-[13px]">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-amber-500"
                />
                You have unsaved profile changes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="secondary-btn"
                  onClick={() => setDiscard(null)}
                >
                  Keep editing
                </Button>
                <Button
                  className="primary-btn"
                  onClick={() => {
                    const next = discard.section;
                    setDiscard(null);
                    setDirty(false);
                    if (next) onSelect(next);
                    else onClose();
                  }}
                >
                  Discard changes
                </Button>
              </div>
            </div>
          )}

          <div
            key={section}
            className="min-h-0 flex-1 animate-in overflow-y-auto overscroll-contain px-5 py-6 duration-200 fade-in-0 motion-reduce:animate-none sm:px-8"
          >
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <SettingsBoundary
                  retry={() => {
                    reset();
                    void client.resetQueries({
                      predicate: (query) => query.state.status === "error",
                    });
                  }}
                >
                  <Suspense fallback={<SettingsSkeleton />}>
                    <SettingsContent section={section} onDirty={setDirty} />
                  </Suspense>
                </SettingsBoundary>
              )}
            </QueryErrorResetBoundary>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}