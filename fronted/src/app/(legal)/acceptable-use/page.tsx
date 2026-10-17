import React from "react";
import type { Metadata } from "next";
import AcceptableUseView from "@/modules/legal/view/AcceptableUseView";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Draftva",
  description:
    "Review Draftva's Acceptable Use Policy. Understand our rules against spam, automated vote manipulation, and unauthorized scraping.",
};

export default function AcceptableUsePage() {
  return <AcceptableUseView />;
}
