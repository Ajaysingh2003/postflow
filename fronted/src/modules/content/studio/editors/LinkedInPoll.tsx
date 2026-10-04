"use client";
import type { Payload } from "@/modules/studio/types";

export default function LinkedInPoll({
  payload,
  onChange,
  readOnly,
}: {
  payload: Payload;
  onChange: (value: Payload) => void;
  readOnly: boolean;
}) {
  const poll = payload.poll as Payload;
  const options = Array.isArray(poll.options) ? (poll.options as string[]) : [];
  const change = (values: Payload) =>
    onChange({ ...payload, poll: { ...poll, ...values } });
  return (
    <div className="border border-border rounded-lg p-3 my-2 mb-4.5 flex flex-col gap-2">
      <input
        className="border border-border rounded-md p-2 bg-transparent text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label="Poll question"
        placeholder="Ask a question"
        maxLength={140}
        readOnly={readOnly}
        value={String(poll.question ?? "")}
        onChange={(e) => change({ question: e.target.value })}
      />
      {options.map((option, index) => (
        <input
          key={index}
          className="border border-border rounded-md p-2 bg-transparent text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Poll option ${index + 1}`}
          placeholder={`Option ${index + 1}`}
          maxLength={30}
          value={option}
          readOnly={readOnly}
          onChange={(e) =>
            change({
              options: options.map((value, i) =>
                i === index ? e.target.value : value,
              ),
            })
          }
        />
      ))}
      {!readOnly && (
        <div className="flex items-center gap-2.5 flex-wrap text-[10px] text-muted-foreground py-1 [&_button:hover]:underline [&_button]:cursor-pointer">
          {options.length < 4 && (
            <button onClick={() => change({ options: [...options, ""] })}>
              Add option
            </button>
          )}
          {options.length > 2 && (
            <button onClick={() => change({ options: options.slice(0, -1) })}>
              Remove last option
            </button>
          )}
          <button
            onClick={() => {
              const next = { ...payload };
              delete next.poll;
              onChange(next);
            }}
          >
            Remove poll
          </button>
        </div>
      )}
      <label className="text-[11px] text-muted-foreground flex items-center justify-between mt-1">
        Poll duration
        <select
          aria-label="Poll duration"
          className="text-[11px] border border-border p-1 rounded bg-background text-foreground outline-none"
          disabled={readOnly}
          value={String(poll.duration ?? "SEVEN_DAYS")}
          onChange={(e) => change({ duration: e.target.value })}
        >
          {["ONE_DAY", "THREE_DAYS", "SEVEN_DAYS", "FOURTEEN_DAYS"].map(
            (value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ").toLowerCase()}
              </option>
            ),
          )}
        </select>
      </label>
    </div>
  );
}
