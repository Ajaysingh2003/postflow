import VerifyOTPView from "@/modules/user/view/VerifyOTPView";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export default async function VerifyEmailPage({ searchParams }: Props) {
  const query = await searchParams;
  return (
    <VerifyOTPView
      email={typeof query.email === "string" ? query.email : ""}
      token={typeof query.token === "string" ? query.token : ""}
    />
  );
}
