"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/client";
import { useComposer } from "@/modules/content/context/ComposerContext";
import { cn } from "@/lib/utils";

function getPageMetadata(pathname: string): { title: string; section?: string } {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return { title: "Overview", section: "Dashboard" };
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
    return { title: "Posts & Replies", section: "Manage" };
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
  const { isComposerOpen, setIsComposerOpen } = useComposer();

  const trpc = useTRPC();
  const { data: currentWorkspace } = useQuery(
    trpc.workspace.current.queryOptions(),
  );

  const workspaceName = currentWorkspace?.name || "Personal Workspace";

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 md:px-6 backdrop-blur-sm">
      {/* Left: Sidebar Toggle + Dynamic Breadcrumb */}
      <div className="flex items-center gap-2.5">
        <SidebarTrigger
          className="size-8 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white transition-colors"
          aria-label="Toggle sidebar"
        />

        <div className="h-4 w-px bg-border/70" />

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
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
      </div>

      {/* Right: Active workspace indicator + AI Assistant Toggle + Quick New Post action */}
      <div className="flex items-center gap-2.5">
        {/* Workspace Pill */}
       

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
          <Sparkles className="size-3.5 text-violet-500" strokeWidth={2} />

        </button>

        {/* Quick New Post */}
        <Link
          href="/dashboard/content/compose"
          className="primary-btn flex !h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
        >
          <Plus className="size-3.5" strokeWidth={2.2} />
          <span className="hidden sm:inline">New Post</span>
        </Link>
      </div>
    </header>
  );
}
