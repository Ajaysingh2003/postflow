"use client";
import TextPostEditor from "./TextPostEditor";
import type { EditorProps } from "./types";

export default function BlueskyEditor(props: EditorProps) {
  return <TextPostEditor {...props} />;
}
