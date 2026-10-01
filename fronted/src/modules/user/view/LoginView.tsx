"use client";

import React from "react";
import LoginForm from "../component/LoginForm";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useTRPCClient } from "@/trpc/client";
import { toast } from "sonner";
import Image from "next/image";
import { Loader2 } from "lucide-react";

function LoginView() {
  const trpc = useTRPCClient();

  const googleSignIn = useMutation({
    mutationFn: () => trpc.user.googleSignIn.mutate(),
    onSuccess: (data) => {
      toast.success("Redirecting to Google");
      window.location.assign(data.url);
    },
    onError: (error) => toast.error(error.message || "Google sign-in failed"),
  });

  // const githubSignIn = useMutation({
  //   mutationFn: () => trpc.user.githubSignIn.mutate(),
  //   onSuccess: (data) => {
  //     toast.success("Redirecting to GitHub");
  //     window.location.assign(data.url);
  //   },
  //   onError: (error) => toast.error(error.message || "GitHub sign-in failed"),
  // });

  const isLoading = googleSignIn.isPending;

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] w-full flex-col">
      <div className="flex flex-1 w-full items-center justify-center p-4">
        <div className="flex w-full max-w-xs flex-col items-center justify-center gap-2">
          {/* Heading */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground font-heading">
              Welcome back
            </h2>
            <p className="text-xs text-muted-foreground">
              Choose your preferred sign-in method
            </p>
          </div>

          {/* Social Auth Providers */}
          <div className="mt-3 flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              className="relative w-full rounded-md border-border !bg-primary text-foreground hover:bg-muted/50 transition-zcolors"
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
              <span className="text-xs font-medium">Continue with Google</span>
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
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginView;