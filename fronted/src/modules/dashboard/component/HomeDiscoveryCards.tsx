import Link from "next/link";
import { ArrowUpRight, BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformMark } from "@/modules/content/studio/AccountSwitcher";

const secondary =
  "secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg !text-xs";

export function HomeConnectionCard({
  canManage,
  canEdit,
  drafts,
}: {
  canManage: boolean;
  canEdit: boolean;
  drafts: number;
}) {
  return (
    <section
      id="continue-writing"
      aria-label="Connect your first channel"
      className="flex min-w-0 scroll-mt-5 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-xs"
    >
      <h2 className="font-heading text-base font-semibold tracking-tight">
        Connect your first channel
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Bring your accounts together to schedule posts and explore their
        performance from one workspace.
      </p>
      <div
        className="flex flex-1 flex-wrap items-center gap-3 py-6"
        aria-label="Available channels include"
      >
        {[
          ["x", "X"],
          ["linkedin", "LinkedIn"],
          ["threads", "Threads"],
          ["instagram", "Instagram"],
        ].map(([platform, label]) => (
          <span
            key={platform}
            className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-xs"
          >
            <PlatformMark platform={platform} />
            {label}
          </span>
        ))}
      </div>
      {!canManage && (
        <p className="mb-4 text-xs leading-5 text-muted-foreground">
          Ask a workspace owner or admin to connect an account.
        </p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
        <Button
          asChild
          className={canManage ? "primary-btn rounded-lg !text-xs" : secondary}
          variant={canManage ? "default" : "outline"}
        >
          <Link href="/dashboard/channels">
            {canManage && <Plus className="size-3.5" />}
            {canManage ? "Connect a channel" : "View channels"}
          </Link>
        </Button>
        <Button asChild variant="outline" className={secondary}>
          <Link
            href={
              canEdit && !drafts
                ? "/dashboard/content?new=1"
                : "/dashboard/content"
            }
          >
            {drafts
              ? `View ${drafts.toLocaleString("en-US")} ${drafts === 1 ? "draft" : "drafts"}`
              : canEdit
                ? "Start writing"
                : "View content"}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function HomeAnalyticsCard({ connected }: { connected: boolean }) {
  return (
    <section
      aria-label="Explore analytics"
      className="flex min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-xs"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <BarChart3 className="size-4" />
        </span>
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Explore analytics
        </h2>
      </div>
      <p className="mb-5 mt-3 max-w-sm flex-1 text-sm leading-6 text-muted-foreground">
        {connected
          ? "Review post performance, compare engagement, and find what resonates with your audience."
          : "Connect a channel to explore your posts and the performance metrics available for your account."}
      </p>
      <div className="flex justify-end border-t border-border/70 pt-4">
        <Button asChild variant="outline" className={secondary}>
          <Link
            href={connected ? "/dashboard/analytics" : "/dashboard/channels"}
          >
            {connected ? "Open analytics" : "View channels"}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
