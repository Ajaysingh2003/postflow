import ForgotPasswordForm from "@/modules/user/component/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div>
        <h1 className="mb-2 text-center text-2xl font-semibold text-slate-950">
          Reset your password
        </h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          We&apos;ll send a secure reset link to your email.
        </p>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
