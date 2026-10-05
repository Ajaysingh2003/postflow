"use client";

import { BarChart3, Plus } from "lucide-react";
import LinkedInEditor from "./LinkedInEditor";
import { composerSettingsSchema, emptySettings } from "../../composerTypes";
import { getAccountAvatarUrl } from "@/modules/channels/component/AccountAvatar";
import { threadItems } from "../../studio/model";
import LinkedInPoll from "../../studio/editors/LinkedInPoll";
import type { EditorProps } from "../../studio/editors/types";

/** Connect the component editor to account-aware drafts and publishing. */
export default function ConnectedLinkedInEditor(props: EditorProps) {
  const { account, payload, onChange, preview, readOnly, onMedia, media, onRefine, capabilities } = props;
  if (Array.isArray(payload.thread)) {
    const items = threadItems(payload);
    return (
      <div className="space-y-4">
        {items.map((item, index) => (
          <ConnectedLinkedInEditor
            key={index}
            {...props}
            payload={item}
            onChange={(next) => onChange({ ...payload, thread: items.map((value, i) => i === index ? next : value) })}
            onRefine={(text, _, start, end, anchor) => onRefine(text, index, start, end, anchor)}
            media={index === 0 ? media : null}
          />
        ))}
        {!readOnly && !preview && (
          <button
            type="button"
            onClick={() => onChange({ ...payload, thread: [...items, { text: "" }] })}
            className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus size={16} />Add to thread
          </button>
        )}
      </div>
    );
  }
  const content = String(payload.text ?? "");
  const settings = composerSettingsSchema.safeParse({
    visibility: payload.visibility === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC",
    mentions: payload.mentions ?? [],
  });
  return (
    <LinkedInEditor
      workspace={{
        account: {
          ...account,
          avatar_url: getAccountAvatarUrl(account),
          headline: String(account.account_metadata.headline ?? "LinkedIn creator"),
        },
        state: {
          localId: account.id,
          draftId: null,
          revision: null,
          platform: "linkedin",
          activePostIndex: 0,
          tone: null,
          content,
          composer: {
            ...(settings.success ? settings.data : emptySettings()),
            connection_id: account.id,
            visibility: payload.visibility === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC",
          },
        },
        setContent: (text) => onChange({ ...payload, text }),
        setSettings: (settings) => onChange({ ...payload, ...settings }),
        saving: readOnly,
        uploadBusy: false,
        setUploadBusy: () => {},
        replaceDraftIfCurrent: (_, expected, text) => {
          if (content === expected) onChange({ ...payload, text });
        },
      }}
      preview={preview || readOnly}
      onBusy={() => {}}
      onRefine={(text, start, end, anchor) => onRefine(text, 0, start, end, anchor)}
      onMedia={onMedia}
      media={media}
      firstComment={false}
      extraTools={capabilities.supports_polls === true && !payload.poll ? (
        <button
          type="button"
          aria-label="Add a poll"
          onClick={() => onChange({ ...payload, poll: { question: "", options: ["", ""], duration: "SEVEN_DAYS" } })}
          className="flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-white"
        >
          <BarChart3 size={18} strokeWidth={1.8} />
        </button>
      ) : null}
    >
      {payload.poll != null && (
        <div className="px-5">
          <LinkedInPoll payload={payload} onChange={onChange} readOnly={readOnly || preview} />
        </div>
      )}
    </LinkedInEditor>
  );
}
