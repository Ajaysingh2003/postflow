import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { caller } from "@/trpc/server";
import { verificationPath } from "@/modules/user/authFlow";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const user = await caller.user.profile();
  if (!user) redirect("/login");
  if (!user.email_verified) redirect(verificationPath(user.email));
  return children;
}
