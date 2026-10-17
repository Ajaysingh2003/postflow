import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { caller } from "@/trpc/server";
import { verificationPath } from "@/modules/user/authFlow";
import InvitationView from "@/modules/workspace/InvitationView";
export const metadata: Metadata = {
  title: "Accept invitation · Draftva",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  if (typeof token !== "string" || token.length < 20 || token.length > 500)
    return (
      <InvitationView
        token=""
        error="This invitation link is incomplete. Ask the workspace owner for a new invitation."
      />
    );
  const [session, result] = await Promise.all([
    caller.user
      .profile()
      .then((user) => ({ user, error: null }))
      .catch(() => ({
        user: null,
        error: "Could not check your account. Please retry.",
      })),
    caller.workspace
      .invitationPreview({ token })
      .then((data) => ({ data, error: null }))
      .catch((error: Error) => ({ data: null, error: error.message })),
  ]);
  if (session.user && !session.user.email_verified)
    redirect(
      verificationPath(
        session.user.email,
        `/invitations/accept?${new URLSearchParams({ token })}`,
      ),
    );
  return (
    <InvitationView
      token={token}
      preview={result.data}
      email={session.user?.email}
      error={result.error || session.error}
    />
  );
}
