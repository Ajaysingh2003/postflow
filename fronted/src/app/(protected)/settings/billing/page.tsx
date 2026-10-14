import { redirect } from "next/navigation";
import { settingsHref } from "@/modules/settings/model";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  redirect(
    settingsHref("billing") +
      (checkout === "success" ? "&checkout=success" : ""),
  );
}
