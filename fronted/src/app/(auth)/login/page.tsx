import { connection } from "next/server";
import { redirect } from "next/navigation";
import { caller } from "@/trpc/server";
import LoginView from "@/modules/user/view/LoginView";
import { safeAuthRedirect, verificationPath } from "@/modules/user/authFlow";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect?: string }>;
}) {
  await connection();
  const query = await searchParams;
  const [user, authConfig] = await Promise.all([
    caller.user.profile(),
    caller.user.authConfig().catch(() => null),
  ]);
  if (user)
    redirect(
      user.email_verified
        ? safeAuthRedirect(query.next || query.redirect)
        : verificationPath(user.email, query.next || query.redirect),
    );
  return <LoginView authConfig={authConfig} />;
}
