"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Bot, ChevronRight, FileText, Plus } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useComposer } from "@/modules/content/context/ComposerContext";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "@/modules/content/studio/AccountSwitcher";

function getPageMetadata(pathname: string): {
  title: string;
  section?: string;
} {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return { title: "Home", section: "Workspace" };
  }
  if (pathname.startsWith("/dashboard/channels")) {
    return { title: "Connected Channels", section: "Manage" };
  }
  if (pathname.startsWith("/dashboard/content/compose")) {
    return { title: "New Post", section: "Create" };
  }
  if (pathname.startsWith("/dashboard/content/schedule")) {
    return { title: "Schedule", section: "Create" };
  }
  if (pathname.startsWith("/dashboard/content")) {
    return { title: "Content", section: "Create" };
  }
  if (pathname.startsWith("/dashboard/assistant")) {
    return { title: "AI Assistant", section: "Create" };
  }
  if (pathname.startsWith("/dashboard/posts")) {
    return { title: "Posts", section: "Manage" };
  }
  if (pathname.startsWith("/dashboard/analytics")) {
    return { title: "Analytics", section: "Manage" };
  }
  if (pathname.startsWith("/dashboard/help")) {
    return { title: "Documentation", section: "Resources" };
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return { title: "Settings", section: "Settings" };
  }

  const segment = pathname.split("/").filter(Boolean).pop() || "Dashboard";
  const formatted = segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { title: formatted, section: "Dashboard" };
}

export default function TopDashboardBar() {
  const pathname = usePathname();
  const { title, section } = getPageMetadata(pathname);
  const { isComposerOpen, setIsComposerOpen, studioNavigation } = useComposer();
  const isContentPage =
    pathname === "/dashboard/content" ||
    pathname.startsWith("/dashboard/content/");
  const contentStudio = [
    "/dashboard/content",
    "/dashboard/analytics",
    "/dashboard/posts",
    "/dashboard/content/compose",
    "/dashboard/content/generator",
  ].includes(pathname);

  function handleNewDraft() {
    window.dispatchEvent(new Event("postflow:new-draft"));
  }

  return (
    <header className="flex h-14 min-w-0 w-full items-center justify-between zborder-b border-border bg-background/95 px-4 md:px-6 backdrop-blur-sm">
      {/* Left: Sidebar Toggle + Dynamic Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2.5">
        <SidebarTrigger
          className="size-8 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors"
          aria-label="Toggle sidebar"
        />

        <div className="h-4 w-px bg-border/70" />

        {contentStudio ? (
          <div className="flex min-w-0 items-center gap-2">
            {studioNavigation ? (
              <AccountSwitcher
                account={studioNavigation.account}
                accounts={studioNavigation.accounts}
                onSelect={studioNavigation.onSelect}
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                {pathname.includes("analytics")
                  ? "Loading account…"
                  : "Writing account…"}
              </span>
            )}
            {studioNavigation?.onPosts && (
              <button
                type="button"
                onClick={studioNavigation.onPosts}
                aria-label="Your posts"
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/[0.06]"
              >
                <FileText className="size-3.5" />
                <span className="hidden sm:inline">Your posts</span>
              </button>
            )}
          </div>
        ) : (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs"
          >
            {section && (
              <>
                <span className="text-neutral-400 dark:text-neutral-500 font-medium">
                  {section}
                </span>
                <ChevronRight className="size-3 text-neutral-300 dark:text-neutral-600" />
              </>
            )}
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-[13px] tracking-tight">
              {title}
            </span>
          </nav>
        )}
      </div>

      {/* Right: Active workspace indicator + AI Assistant Toggle + Quick New Post action */}
      <div className="flex shrink-0 items-center gap-2.5">
        {/* Workspace Pill */}

        {isContentPage && (
          <>
            {/* AI Writing Assistant Toggle */}
            <button
              type="button"
              onClick={() => setIsComposerOpen((prev) => !prev)}
              aria-label="Toggle AI writing assistant"
              title="Toggle AI writing assistant"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all duration-150",
                isComposerOpen
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300 shadow-xs"
                  : "border-border/80 bg-neutral-50/80 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white",
              )}
            >
              <Bot className="size-3.5 text-violet-500" strokeWidth={2} />
            </button>

            {/* New Draft Action */}
            <button
              type="button"
              onClick={handleNewDraft}
              aria-label="New draft"
              title="New draft"
              className="primary-btn flex !h-8 !min-h-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-medium"
            >
              <Plus className="size-3.5" strokeWidth={2.2} />
              <span>New draft</span>
            </button>
          </>
        )}

      </div>
    </header>
  );
}
