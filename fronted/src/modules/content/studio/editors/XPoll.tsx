"use client";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Payload } from "@/modules/studio/types";

const durations = [
  { value: "60", label: "1 hour" },
  { value: "1440", label: "1 day" },
  { value: "4320", label: "3 days" },
  { value: "10080", label: "7 days" },
];

export default function XPoll({
  payload,
  onChange,
  readOnly,
}: {
  payload: Payload;
  onChange: (value: Payload) => void;
  readOnly: boolean;
}) {
  const durationId = useId();
  const poll = payload.poll as Payload;
  const options = Array.isArray(poll.options) ? (poll.options as string[]) : [];
  const change = (values: Payload) =>
    onChange({ ...payload, poll: { ...poll, ...values } });
  return (
    <div
      className="border border-border rounded-lg p-3 my-2 mb-4.5 flex flex-col gap-2"
      role="group"
      aria-label="X poll"
    >
      {options.map((option, index) => (
        <Input
          key={index}
          aria-label={`Poll option ${index + 1}`}
          placeholder={`Option ${index + 1}`}
          maxLength={25}
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
        <div className="flex items-center gap-2.5 flex-wrap text-[10px] text-muted-foreground py-1">
          {options.length < 4 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => change({ options: [...options, ""] })}
            >
              Add option
            </Button>
          )}
          {options.length > 2 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => change({ options: options.slice(0, -1) })}
            >
              Remove last option
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              const next = { ...payload };
              delete next.poll;
              onChange(next);
            }}
          >
            Remove poll
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={durationId}>Poll duration</Label>
        <Select
          items={durations}
          disabled={readOnly}
          value={String(poll.duration_minutes ?? 1440)}
          onValueChange={(value) =>
            value && change({ duration_minutes: Number(value) })
          }
        >
          <SelectTrigger id={durationId} aria-label="Poll duration" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durations.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
