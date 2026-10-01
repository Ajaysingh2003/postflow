"use client";

import React from "react";
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



  const isLoading = googleSignIn.isPending

  return (
    <div className="flex min-h-[calc(100dvh-1rem)] w-full flex-col">
      <div className="flex flex-1 w-full items-center justify-center p-4">
        <div className="flex w-full max-w-xs flex-col items-center justify-center gap-2">
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground font-heading">
              Create an account
            </h2>
            <p className="text-xs text-muted-foreground">
              Sign up to get started with your trading bots
            </p>
          </div>

          {/* Social Auth Providers */}
          <div className="mt-3 flex w-full flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              className="relative w-full rounded-md border-border !bg-primary text-foreground hover:bg-muted/50 transition-colors"
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

          {/* Divider */}
          <div className="relative my-4 flex w-full items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              or continue with
            </span>
          </div>

          {/* Registration Form */}
          <div className="w-full">
            <RegisterForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterView;