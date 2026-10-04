import type { ReactNode } from "react";
import type { Account, Payload } from "@/modules/studio/types";

export type EditorProps = {
  account: Account;
  payload: Payload;
  onChange: (payload: Payload) => void;
  capabilities: Payload;
  readOnly: boolean;
  preview: boolean;
  status?: string;
  onRefine: (
    text?: string,
    index?: number,
    start?: number,
    end?: number,
    anchor?: HTMLElement,
  ) => void;
  onMedia: () => void;
  media: ReactNode;
};
