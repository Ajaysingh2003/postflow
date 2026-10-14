"use client";

import React from "react";
import VerifyOTPForm from "../component/VerifyOTPForm";

interface VerifyOTPViewProps {
  email: string;
  token?: string;
  initialCooldown?: number;
}

export default function VerifyOTPView({
  email,
  token,
  initialCooldown,
}: VerifyOTPViewProps) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col">
      <div className="flex h-full flex-1 w-full items-center justify-center p-4">
        <div className="card-shadow relative z-10 mt-4 block w-full rounded-lg bg-background p-6 card max-w-sm">
          {/* Verification Badge & Header */}
          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Verify your email
            </h2>
            <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
              {token && token.length >= 20 ? (
                "Confirm this verification link to verify your email."
              ) : (
                <>
                  Enter the latest 6-digit code for{" "}
                  {email ? (
                    <span className="break-all font-medium text-foreground">
                      {email}
                    </span>
                  ) : (
                    "your inbox"
                  )}
                  . If you need a code, request one below.
                </>
              )}
            </p>
          </div>

          {/* Primary Form */}
          <div className="mt-6 w-full">
            <VerifyOTPForm
              email={email ?? ""}
              token={token}
              initialCooldown={initialCooldown}
            />
          </div>

          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Used the wrong email? Edit the address above and request a new
              code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
