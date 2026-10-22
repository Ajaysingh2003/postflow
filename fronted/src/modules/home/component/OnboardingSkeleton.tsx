import OnboardingShell from "./OnboardingShell";

export default function OnboardingSkeleton() {
  return (
    <OnboardingShell>
      <div role="status" aria-label="Loading your setup" className="w-full">
        <div className="mx-auto mb-8 h-5 w-48 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="rounded-3xl border border-border bg-card p-7 sm:p-10">
          <div className="mx-auto mb-5 h-9 w-3/4 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="mx-auto mb-9 h-4 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-[78px] rounded-2xl bg-muted motion-safe:animate-pulse"
              />
            ))}
          </div>
          <div className="mt-9 flex justify-end border-t border-border pt-6">
            <div className="h-11 w-48 rounded-xl bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    </OnboardingShell>
  );
}
