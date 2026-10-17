"use client"
import React from "react";
import { LegalDocumentLayout } from "../components/LegalDocumentLayout";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { COOKIES_SECTIONS } from "../data/cookiesData";

export default function CookiesView() {
  const meta = LEGAL_DOCS.find((d) => d.id === "cookies")!;
  return <LegalDocumentLayout meta={meta} sections={COOKIES_SECTIONS} />;
}
