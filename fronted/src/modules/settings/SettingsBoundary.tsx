"use client";
import { Component, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
export function SettingsSkeleton() {
  return (
    <div role="status" aria-label="Loading settings" className="space-y-7">
      <Skeleton className="size-14 rounded-full" />
      {[1, 2, 3].map((key) => (
        <div key={key} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}
export class SettingsBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert" className="py-16 text-center">
          <h3 className="text-base font-semibold">
            Couldn’t load these settings
          </h3>
          <p className="my-3 text-sm text-muted-foreground">
            Try again. You can still open the other sections.
          </p>
          <Button
            className="primary-btn"
            onClick={() => {
              this.props.retry();
              this.setState({ failed: false });
            }}
          >
            Try again
          </Button>
        </div>
      );
    return this.props.children;
  }
}
