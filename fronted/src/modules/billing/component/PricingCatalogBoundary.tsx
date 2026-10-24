"use client";

import { Component, Suspense, type ReactNode } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { PricingSkeleton } from "./PricingCardSection";

class CatalogError extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="rounded-2xl border border-border bg-background px-6 py-12 text-center"
      >
        <h3 className="font-heading text-2xl">Prices couldn’t load</h3>
        <p className="my-4 text-sm text-muted-foreground">
          Please try again to see the current prices.
        </p>
        <button
          type="button"
          className="secondary-btn rounded-lg"
          onClick={() => {
            this.props.retry();
            this.setState({ failed: false });
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export function PricingCatalogBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <CatalogError retry={reset}>
          <Suspense fallback={<PricingSkeleton />}>{children}</Suspense>
        </CatalogError>
      )}
    </QueryErrorResetBoundary>
  );
}
