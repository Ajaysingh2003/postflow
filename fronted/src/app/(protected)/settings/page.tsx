import { redirect } from "next/navigation";
import { settingsHref } from "@/modules/settings/model";
export default function Page() {
  redirect(settingsHref());
}
