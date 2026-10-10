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
    <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col">
      <div className="flex h-full flex-1 w-full items-center justify-center p-4">
        <div className="card-shadow relative z-10 mt-4 block w-full rounded-lg bg-background p-6 card sm:w-98">
          

          {/* Verification Badge & Header */}
          <div className="space-y-1.5">
            

            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Verify your email
            </h2>
            <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
              Enter the 6-digit confirmation code sent to{" "}
              {email ? (
                <span className="font-medium text-foreground break-all">
                  {email}
                </span>
              ) : (
                "your inbox"
              )}
              .
            </p>
          </div>

          {/* Primary Form */}
          <div className="mt-6 w-full">
            <VerifyOTPForm email={email ?? ""} token={token} />
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Didn&apos;t receive a code or used the wrong address?{" "}
              <Link
                href="/register"
                className="font-medium text-brand-primary underline-offset-4 hover:underline"
              >
                Change email
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}