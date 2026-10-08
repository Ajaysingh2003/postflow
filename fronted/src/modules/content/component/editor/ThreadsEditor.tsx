"use client";

import XEditor from "../../studio/editors/XEditor";
import type { EditorProps } from "../../studio/editors/types";
import { EditorNotice } from "./SocialEditor";
import { editorMedia, socialEditorIssues } from "./socialEditorModel";

// Threads shares X's post toolbar, reply-chain layout, and poll option controls.
export default function ThreadsEditor(props: EditorProps) {
  const issues = socialEditorIssues(
    "threads",
    props.payload,
    editorMedia(props.payload, props.mediaIds, props.mediaAssets),
    props.capabilities,
  );
  return (
    <>
      <XEditor {...props} />
      {issues.map((issue) => <EditorNotice key={issue}>{issue}</EditorNotice>)}
    </>
  );
}
