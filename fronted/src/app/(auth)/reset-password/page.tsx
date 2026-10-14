import ResetPasswordView from "@/modules/user/view/ResetPasswordView";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  return <ResetPasswordView token={token} />;
}
