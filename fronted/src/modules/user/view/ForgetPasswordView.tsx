"use client";

import ForgotPasswordForm from "../component/ForgotPasswordForm";

function ForgetPasswordView() {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] w-full flex-col">
      <div className="flex h-full flex-1 w-full items-center justify-center p-4">
        <div className="card card-shadow relative z-10 mt-4 w-full max-w-sm rounded-lg bg-background p-6">
          <div className="space-y-1">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Reset your password
            </h2>
            <p className="text-[14px] font-medium text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset your
              password.
            </p>
          </div>

          <div className="mt-6 w-full">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgetPasswordView;
