"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useTRPCClient } from "@/trpc/client";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOTPForm({
  email: initialEmail = "",
  token = "",
}: {
  email?: string;
  token?: string;
}) {
  const router = useRouter();
  const trpc = useTRPCClient();
  const [email, setEmail] = useState(initialEmail);
  const [verificationToken, setVerificationToken] = useState(token);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
      setIsEditingEmail(false);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (token) {
      setVerificationToken(token.replace(/\D/g, "").slice(0, 6));
    }
  }, [token]);

  // 1-minute countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: (input: { email: string; token: string }) =>
      trpc.user.verifyEmail.mutate(input),
    onSuccess: () => {
      toast.success("Email verified successfully");
      router.replace("/login");
    },
    onError: (error) => toast.error(error.message || "Verification failed"),
  });

  const resend = useMutation({
    mutationFn: (input: { email: string }) =>
      trpc.user.resendVerification.mutate(input),
    onSuccess: () => {
      toast.success("A new verification code has been sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) => toast.error(error.message || "Failed to resend code"),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanToken = verificationToken.replace(/\D/g, "").trim();

    if (!cleanEmail) {
      toast.error("Please enter your email address");
      return;
    }
    if (cleanToken.length !== 6) {
      toast.error("Please enter all 6 digits of the verification code");
      return;
    }

    verify.mutate({ email: cleanEmail, token: cleanToken });
  };

  const handleResend = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error("Please enter your email address first");
      return;
    }
    if (cooldown > 0) return;

    resend.mutate({ email: cleanEmail });
  };

  const isVerifyDisabled =
    verify.isPending ||
    verificationToken.replace(/\D/g, "").length !== 6 ||
    !email.trim();

  const isResendDisabled = resend.isPending || cooldown > 0 || !email.trim();

  return (
    <div className="w-full   zflex items-center justify-center ">
      <div className=" space-y-4">

      
      <form onSubmit={handleSubmit} className="space-y-3">
        {isEditingEmail ? (
          <div>
            <label
              htmlFor="verification-email"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Email address
            </label>
            <Input
              id="verification-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              className="rounded-md border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-1"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <span className="truncate">
              Verifying: <strong className=" text-foreground">{email}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsEditingEmail(true)}
              className="ml-2 shrink-0 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Change
            </button>
          </div>
        )}

<div>
          <label
            htmlFor="verification-token"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Verification Code (OTP)
          </label>
          <div className="w-full">
            <InputOTP
              id="verification-token"
              maxLength={6}
              value={verificationToken}
              onChange={(val: string) => setVerificationToken(val.replace(/\D/g, ""))}
              containerClassName="w-full"
              className="w-full"
            >
              <InputOTPGroup className="w-full flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="flex-1 h-9 !rounded-sm border border-border bg-background text-foreground shadow-xs transition-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border data-[active=true]:ring-0 data-[active=true]:border-border"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>
        <Button
          type="submit"
          disabled={isVerifyDisabled}
          className="w-full primary-btn rounded-md font-medium"
        >
          {verify.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {verify.isPending ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      {email.trim() && (
        <Button
          type="button"
          variant="outline"
          disabled={isResendDisabled}
          onClick={handleResend}
          className="w-full rounded-md border-border  shadow-sm  text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          {resend.isPending ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Sending code…
            </>
          ) : cooldown > 0 ? (
            `Resend code in ${cooldown}s`
          ) : (
            "Resend verification code"
          )}
        </Button>
      )}
    </div>
    </div>
  );
}