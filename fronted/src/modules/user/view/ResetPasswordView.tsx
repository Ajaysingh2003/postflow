"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import ResetPasswordForm from "../component/ResetPasswordForm";

interface ResetPasswordViewProps {
  token?: string;
}

export default function ResetPasswordView({ token = "" }: ResetPasswordViewProps) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col">
      <div className="flex h-full flex-1 w-full items-center justify-center p-4">
        <div className="card-shadow relative z-10 mt-4 block w-full rounded-lg bg-background p-6 card sm:w-98">
          

          {/* Heading & Icon */}
          <div className="space-y-1.5">
            

            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Set new password
            </h2>
            <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
              Your new password must be different from previously used passwords.
            </p>
          </div>

          {/* Primary Form */}
          <div className="mt-6 w-full">
            <ResetPasswordForm token={token} />
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-medium text-brand-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}