import React from "react";
import type { Metadata } from "next";
import CookiesView from "@/modules/legal/view/CookiesView";

export const metadata: Metadata = {
  title: "Cookie Policy | Draftva",
  description:
    "Explore how Draftva uses essential cookies and local storage to keep your session secure and customize your workspace experience.",
};

export default function CookiePolicyPage() {
  return <CookiesView />;
}
