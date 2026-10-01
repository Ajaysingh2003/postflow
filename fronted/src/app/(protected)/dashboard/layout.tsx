"use client";

import { useSyncExternalStore } from "react";
import { AppSidebar } from "@/components/base/AppSidebar";
import TopDashboardBar from "@/components/base/TopDashboardBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { ComposerSidecar } from "@/modules/content/component/ComposerSidecar";
import { ComposerProvider, useComposer } from "@/modules/content/context/ComposerContext";

function subscribeCompactAssistant(onChange: () => void) {
  const media = window.matchMedia("(max-width: 1279px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getCompactAssistant = () => window.matchMedia("(max-width: 1279px)").matches;
const getServerCompactAssistant = () => false;

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isComposerOpen, setIsComposerOpen } = useComposer();
  const compactAssistant = useSyncExternalStore(
    subscribeCompactAssistant, getCompactAssistant, getServerCompactAssistant,
  );

  return (
    <SidebarProvider
      className="h-svh max-h-svh w-full overflow-hidden"
      style={
        {
          "--sidebar-width": "225px",
        } as React.CSSProperties
      }
    >
      <AppSidebar />

      <main
        className="
          flex
          h-svh
          min-w-0
          flex-1
          flex-col
          overflow-hidden
          bg-primary
          px-2
          pb-2
        "
      >
        <div
          className={cn(
            "mx-auto grid h-full min-h-0 w-full max-w-[1600px] grid-cols-1",
            isComposerOpen && "xl:grid-cols-[minmax(0,1fr)_clamp(420px,34vw,550px)]"
          )}
        >
          {/* ========================================================== */}
          {/* LEFT SIDE: Topbar + Main Content                           */}
          {/* ========================================================== */}

          <div
            className="
              flex
              min-h-0
              min-w-0
              flex-col
            "
          >
            {/* Top Dashboard Bar */}

            <div
              className="
                z-20
                shrink-0
                py-2
                pr-2
              "
            >
              <TopDashboardBar />
            </div>

            {/* Main Content */}

            <div
              className="
                relative
                min-h-0
                min-w-0
                flex-1
                overflow-hidden

                rounded-tl-2xl
                rounded-bl-2xl

                border-y
                border-l
                border-border

                bg-background
                shadow-sm
              "
            >
              <div
                className="
                  h-full
                  min-h-0
                  overflow-y-auto
                  p-0
                  md:p-3z
                "
              >
                {children}
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* RIGHT SIDE: Copilot                                        */}
          {/* ========================================================== */}

          {isComposerOpen && !compactAssistant && (
            <div
              className="
                hidden
                min-h-0
                min-w-0
                pt-2z

                xl:block
              "
            >
              <ComposerSidecar onClose={() => setIsComposerOpen(false)} />
            </div>
          )}
        </div>
      </main>
      <Dialog open={isComposerOpen && compactAssistant} onOpenChange={setIsComposerOpen}>
        <DialogContent className="h-[100dvh] max-w-lg overflow-hidden p-0" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle className="font-heading">Writing assistant</DialogTitle>
            <DialogDescription>Write a LinkedIn post and manage your persona settings.</DialogDescription>
          </DialogHeader>
          <ComposerSidecar onClose={() => setIsComposerOpen(false)} />
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ComposerProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </ComposerProvider>
  );
}
