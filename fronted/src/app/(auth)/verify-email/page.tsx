import VerifyOTPView from "@/modules/user/view/VerifyOTPView";

type PageProps = {
  searchParams: Promise<{ email?: string; token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { email = "", token = "" } = await searchParams;
  return <VerifyOTPView email={email} token={token} />;
}
