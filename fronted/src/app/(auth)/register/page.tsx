import { connection } from "next/server";
import { redirect } from "next/navigation";
import { caller } from "@/trpc/server";
import RegisterView from "@/modules/user/view/RegisterView";
import { verificationPath } from "@/modules/user/authFlow";

export default async function RegisterPage() {
  await connection();
  const [user, authConfig] = await Promise.all([
    caller.user.profile(),
    caller.user.authConfig().catch(() => null),
  ]);
  if (user)
    redirect(user.email_verified ? "/dashboard" : verificationPath(user.email));
  return <RegisterView authConfig={authConfig} />;
}
