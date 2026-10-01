"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import VerifyOTPForm from "../component/VerifyOTPForm";

interface VerifyOTPViewProps {
  email: string;
  token?: string;
}

export default function VerifyOTPView({ email, token }: VerifyOTPViewProps) {
  return (
    <div className="flex min-h-[calc(100dvh-1rem)] w-full flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-sm  flex-col items-center justify-center gap-4">
        {/* Verification Icon Badge */}
        <div className="flex size-11 items-center justify-center rounded-sm border border-border bg-muted/40 text-foreground shadow-xs">
          <ShieldCheck className="size-5.5 text-foreground" />
        </div>

        {/* Header */}
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground font-heading">
            Verify your email
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Enter the 6-digit confirmation code sent to
          </p>
          {email ? (
            <span className="inline-block rounded-sm border border-border/80 bg-muted/30 px-2 py-0.5  text-xs font-medium text-foreground">
              {email}
            </span>
          ) : (
            <p className="text-xs text-muted-foreground">your inbox</p>
          )}
        </div>

        {/* Form Container */}
        <div className="w-full">
          <VerifyOTPForm email={email ?? ""} token={token} />
        </div>

        {/* Navigation Escape Hatch */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}