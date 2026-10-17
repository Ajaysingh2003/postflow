"use client"
import React from "react";
import { LegalDocumentLayout } from "../components/LegalDocumentLayout";
import { LEGAL_DOCS } from "../data/legalDocsList";
import { DPA_SECTIONS } from "../data/dpaData";

export default function DpaView() {
  const meta = LEGAL_DOCS.find((d) => d.id === "dpa")!;
  return <LegalDocumentLayout meta={meta} sections={DPA_SECTIONS} />;
}
