"use client"
import React from "react";
import { LegalDocumentLayout } from "../components/LegalDocumentLayout";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { PRIVACY_SECTIONS } from "../data/privacyData";

export default function PrivacyView() {
  const meta = LEGAL_DOCS.find((d) => d.id === "privacy")!;
  return <LegalDocumentLayout meta={meta} sections={PRIVACY_SECTIONS} />;
}
