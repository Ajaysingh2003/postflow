import type { ReactNode } from "react";
import { Feather } from "lucide-react";

export default function OnboardingShell({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f9f6] text-foreground dark:bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <span className="flex items-center gap-2.5 font-heading text-2xl font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-primary/20 text-emerald-800 dark:text-emerald-300">
            <Feather className="size-4" aria-hidden="true" />
          </span>
          draftva<span className="-ml-2 text-emerald-600">.</span>
        </span>
        {action}
      </header>
      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col justify-center px-5 pb-10 pt-4 sm:px-10 sm:pb-16">
        {children}
      </main>
      <footer className="pb-6 text-center text-xs text-muted-foreground">
        A little less busywork. A little more you.
      </footer>
    </div>
  );
}
