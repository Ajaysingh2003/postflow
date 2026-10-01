import ResetPasswordForm from "@/modules/user/component/ResetPasswordForm";

type PageProps = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token = "" } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div>
        <h1 className="mb-6 text-center text-2xl font-semibold text-slate-950">
          Choose a new password
        </h1>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}
