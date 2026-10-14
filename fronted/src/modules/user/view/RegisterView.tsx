"use client";

import Link from "next/link";
import RegisterForm from "../component/RegisterForm";
import SocialAuthButtons from "../component/SocialAuthButtons";
import type { AuthProviderConfig } from "../types";

export default function RegisterView({
  authConfig,
}: {
  authConfig?: AuthProviderConfig | null;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full items-center justify-center p-4">
      <div className="card card-shadow relative z-10 w-full max-w-sm rounded-lg bg-background p-6">
        <h1 className="font-heading text-2xl font-semibold">
          Create your Draftva account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
        <div className="mt-6">
          <SocialAuthButtons register initialConfig={authConfig} />
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
