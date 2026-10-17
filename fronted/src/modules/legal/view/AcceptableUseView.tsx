"use client"
import React from "react";
import { LegalDocumentLayout } from "../components/LegalDocumentLayout";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { ACCEPTABLE_USE_SECTIONS } from "../data/acceptableUseData";

export default function AcceptableUseView() {
  const meta = LEGAL_DOCS.find((d) => d.id === "acceptable-use")!;
  return <LegalDocumentLayout meta={meta} sections={ACCEPTABLE_USE_SECTIONS} />;
}
