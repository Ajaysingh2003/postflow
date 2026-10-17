import React from "react";
import type { LucideIcon } from "lucide-react";

export type LegalDocId =
  | "terms"
  | "privacy"
  | "cookies"
  | "acceptable-use"
  | "dpa"
  | "subprocessors";

export interface LegalSummaryPoint {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface LegalSubSection {
  id: string;
  title: string;
}

export interface LegalSection {
  id: string;
  number?: string;
  title: string;
  content: React.ReactNode;
  subsections?: LegalSubSection[];
}

export interface LegalDocMeta {
  id: LegalDocId;
  title: string;
  shortTitle: string;
  slug: string;
  lastUpdated: string;
  effectiveDate: string;
  version: string;
  readTime: string;
  description: string;
  summaries: LegalSummaryPoint[];
}
