"use client";
import TextPostEditor from "./TextPostEditor";
import type { EditorProps } from "./types";

export default function MastodonEditor(props: EditorProps) {
  return (
    <TextPostEditor
      {...props}
      beforeText={(payload, onChange) => (
        <label className="flex flex-col gap-2 text-[11px] my-3.5">
          <span className="text-muted-foreground font-medium">Content warning</span>
          <input
            className="border border-border p-2.5 rounded-md text-xs bg-background text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Content warning"
            placeholder="Optional content warning"
            readOnly={props.readOnly || props.preview}
            value={String(payload.spoiler_text ?? "")}
            onChange={(e) =>
              onChange({
                ...payload,
                spoiler_text: e.target.value,
                sensitive: Boolean(e.target.value),
              })
            }
          />
        </label>
      )}
    />
  );
}
