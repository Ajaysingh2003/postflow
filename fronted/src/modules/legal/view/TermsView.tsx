"use client"
import React from "react";
import { LegalDocumentLayout } from "../components/LegalDocumentLayout";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { TERMS_SECTIONS } from "../data/termsData";

export default function TermsView() {
  const meta = LEGAL_DOCS.find((d) => d.id === "terms")!;
  return <LegalDocumentLayout meta={meta} sections={TERMS_SECTIONS} />;
}
