"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import RegisterForm from "../component/RegisterForm";
import { Button } from "@/components/ui/button";
import { useTRPCClient } from "@/trpc/client";

function RegisterView() {
  const trpc = useTRPCClient();

  const googleSignIn = useMutation({
    mutationFn: () => trpc.user.googleSignIn.mutate(),
    onSuccess: (data) => {
      toast.success("Redirecting to Google");
      window.location.assign(data.url);
    },
    onError: (error) => toast.error(error.message || "Google sign-up failed"),
  });

  const isLoading = googleSignIn.isPending;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col">
      <div className="flex h-full flex-1 w-full items-center justify-center p-4">
        <div className="card-shadow block bg-background p-6 mt-4 card w-full sm:w-98 relative z-10 rounded-lg flex-col items-center justify-center">
          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground font-heading">
             Get started with Draftva
            </h2>
            <p className="text-[14px] font-medium text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-brand-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Social Auth Providers */}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              className="relative w-full font-medium rounded-md border-border !bg-primary text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => googleSignIn.mutate()}
            >
              {googleSignIn.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Image
                  src="/google.png"
                  height={16}
                  width={16}
                  alt="Google logo"
                  className="mr-2 shrink-0"
                />
              )}
              <span className="text-xs font-medium">Google</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              className="relative w-full font-medium rounded-md border-border !bg-primary text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => googleSignIn.mutate()}
            >
              {googleSignIn.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Image
                  src="/channels/x.jpeg"
                  height={16}
                  width={16}
                  alt="X logo"
                  className="mr-2 shrink-0"
                />
              )}
              <span className="text-xs font-medium">X</span>
            </Button>
          </div>

          {/* Centered Semantic Divider */}
          <div className="relative my-4 flex w-full items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              or continue with
            </span>
          </div>

          {/* Primary Form */}
          <div className="w-full">
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterView;