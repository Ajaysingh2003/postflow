import { connection } from "next/server";
import { redirect } from "next/navigation";
import VerifyOTPView from "@/modules/user/view/VerifyOTPView";
import { caller } from "@/trpc/server";
import { safeAuthRedirect } from "@/modules/user/authFlow";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export default async function VerifyOTPPage({ searchParams }: Props) {
  await connection();
  const query = await searchParams;
  const user = await caller.user.profile();
  if (user?.email_verified) redirect(safeAuthRedirect(query.next));
  const status = user ? await caller.user.verificationStatus() : null;
  const email =
    user?.email || (typeof query.email === "string" ? query.email : "");
  const token = typeof query.token === "string" ? query.token : "";
  return (
    <VerifyOTPView
      email={email}
      token={token}
      initialCooldown={status?.retry_after || 0}
      initialError={status?.delivery_status === "failed" ? status.message : ""}
    />
  );
}
