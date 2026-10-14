"use client";

import Link from "next/link";
import LoginForm from "../component/LoginForm";
import SocialAuthButtons from "../component/SocialAuthButtons";
import type { AuthProviderConfig } from "../types";

export default function LoginView({
  authConfig,
}: {
  authConfig?: AuthProviderConfig | null;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center p-4">
      <div className="card card-shadow relative z-10 w-full max-w-sm rounded-lg bg-background p-6">
        <h1 className="font-heading text-2xl font-semibold">
          Sign in to Draftva
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href="/register"
            className="font-medium text-foreground hover:underline"
          >
            Create an account
          </Link>
        </p>
        <div className="mt-6">
          <SocialAuthButtons initialConfig={authConfig} />
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
