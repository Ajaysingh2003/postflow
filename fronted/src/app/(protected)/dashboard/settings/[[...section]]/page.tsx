import { redirect } from "next/navigation";
import { settingsHref, settingsSection } from "@/modules/settings/model";
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const selected =
    section?.[0] === "usage"
      ? "billing"
      : (settingsSection(section?.[0] ?? null) ?? "profile");
  redirect(settingsHref(selected));
}
