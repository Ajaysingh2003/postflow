"use client";

import Link from "next/link";
export default function AuthError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4">
      <div className="card card-shadow w-full max-w-sm space-y-4 rounded-lg p-6">
        <h1 className="font-heading text-xl font-semibold">
          Could not load this page
        </h1>
        <p role="alert" className="text-sm text-muted-foreground">
          Your connection may be temporarily unavailable. Please try again.
        </p>
        <button onClick={reset} className="primary-btn w-full rounded-md">
          Try again
        </button>
        <Link
          href="/login"
          className="secondary-btn flex w-full justify-center rounded-md"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
