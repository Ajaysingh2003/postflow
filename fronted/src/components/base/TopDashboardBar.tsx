"use client";

import React, { useState } from "react";
import { Bell, BookOpen, Feather, FileText, Sparkles } from "lucide-react";
import { SidebarTrigger } from "../ui/sidebar";
import { Button } from "../ui/button";
import { useComposer } from "@/modules/content/context/ComposerContext";
import { DraftDialog } from "@/modules/content/component/DraftDialog";
// import { ThemeToggle } from "./ThemeToggle";

function TopDashboardBar() {
  const { state,setIsComposerOpen } = useComposer();
  const [openDraftDialog, setOpenDraftDialog] = useState(false);

  const hasActiveDraft = Boolean(state.content && state.content.trim().length > 0);

  return (
    <>
      <header className="flex h-10 w-full items-center justify-between pr-4 md:pr-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/[0.06]" />

          <div className="hidden h-4 w-px bg-neutral-300 dark:bg-white/[0.08] sm:block" />

          <span className="hidden text-sm font-medium text-neutral-600 dark:text-neutral-400 sm:block">
            Content workspace
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* <ThemeToggle /> */}
          <button
            type="button"
            aria-label="Notifications"
            className="secondary-btnz relative rounded-lg flex size-9 items-center justify-center !border-none !p-0 text-foreground dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            <Bell className="size-3.5 text-foreground" />

            <span className="absolute right-[7px] top-[7px] size-1.5 rounded-full bg-violet-500 ring-2 ring-white dark:ring-[#0a0a0a]" />
          </button>

          {/* Drafts Button */}
          <button
            type="button"
            aria-label="Drafts & Scratchpad"
            title="Drafts & Scratchpad"
            onClick={() => setOpenDraftDialog(true)}
            className="secondary-btnz relative rounded-lg flex size-9 items-center justify-center !border-none !p-0 text-foreground dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            <FileText className="size-3.5 text-foreground" />
            {hasActiveDraft && (
              <span className="absolute right-[7px] top-[7px] size-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0a0a0a]" />
            )}
          </button>

          {/* Feather action */}
          <button
          onClick={() => setIsComposerOpen((prev) => !prev)}
            type="button"
            aria-label="Open writing assistant"
            className="secondary-btnz relative rounded-lg flex size-9 items-center justify-center !border-none !p-0 text-foreground dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          >
            <Feather className="size-3.5 text-foreground" />
          </button>

          <Button className="primary-btn gap-2 !py-1 !rounded-lg px-3.5">
            <Sparkles className="size-4" />

            <span className="hidden sm:inline">Start free trial</span>
            <span className="sm:hidden">Trial</span>
          </Button>
        </div>
      </header>

      {/* Drafts Dialog */}
      <DraftDialog
        open={openDraftDialog}
        setOpen={setOpenDraftDialog}
      />
    </>
  );
}

export default TopDashboardBar;
