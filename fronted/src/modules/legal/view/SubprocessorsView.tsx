"use client"
import React from "react";
import { LegalDocumentLayout } from "../components/LegalDocumentLayout";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { SUBPROCESSORS_SECTIONS } from "../data/subprocessorsData";

export default function SubprocessorsView() {
  const meta = LEGAL_DOCS.find((d) => d.id === "subprocessors")!;
  return <LegalDocumentLayout meta={meta} sections={SUBPROCESSORS_SECTIONS} />;
}
