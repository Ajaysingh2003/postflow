// "use client";
// import { useId } from "react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import type { Payload } from "@/modules/studio/types";

// const durations = [
//   { value: "60", label: "1 hour" },
//   { value: "1440", label: "1 day" },
//   { value: "4320", label: "3 days" },
//   { value: "10080", label: "7 days" },
// ];

// export default function XPoll({
//   payload,
//   onChange,
//   readOnly,
// }: {
//   payload: Payload;
//   onChange: (value: Payload) => void;
//   readOnly: boolean;
// }) {
//   const durationId = useId();
//   const poll = payload.poll as Payload;
//   const options = Array.isArray(poll.options) ? (poll.options as string[]) : [];
//   const change = (values: Payload) =>
//     onChange({ ...payload, poll: { ...poll, ...values } });
//   return (
//     <div
//       className="border border-border rounded-lg p-3 my-2 mb-4.5 flex flex-col gap-2"
//       role="group"
//       aria-label="X poll"
//     >
//       {options.map((option, index) => (
//         <Input
//           key={index}
//           aria-label={`Poll option ${index + 1}`}
//           placeholder={`Option ${index + 1}`}
//           maxLength={25}
//           value={option}
//           readOnly={readOnly}
//           onChange={(e) =>
//             change({
//               options: options.map((value, i) =>
//                 i === index ? e.target.value : value,
//               ),
//             })
//           }
//         />
//       ))}
//       {!readOnly && (
//         <div className="flex items-center gap-2.5 flex-wrap text-[10px] text-muted-foreground py-1">
//           {options.length < 4 && (
//             <Button
//               variant="ghost"
//               size="xs"
//               onClick={() => change({ options: [...options, ""] })}
//             >
//               Add option
//             </Button>
//           )}
//           {options.length > 2 && (
//             <Button
//               variant="ghost"
//               size="xs"
//               onClick={() => change({ options: options.slice(0, -1) })}
//             >
//               Remove last option
//             </Button>
//           )}
//           <Button
//             variant="ghost"
//             size="xs"
//             onClick={() => {
//               const next = { ...payload };
//               delete next.poll;
//               onChange(next);
//             }}
//           >
//             Remove poll
//           </Button>
//         </div>
//       )}
//       <div className="flex items-center justify-between gap-3">
//         <Label htmlFor={durationId}>Poll duration</Label>
//         <Select
//           items={durations}
//           disabled={readOnly}
//           value={String(poll.duration_minutes ?? 1440)}
//           onValueChange={(value) =>
//             value && change({ duration_minutes: Number(value) })
//           }
//         >
//           <SelectTrigger id={durationId} aria-label="Poll duration" size="sm">
//             <SelectValue />
//           </SelectTrigger>
//           <SelectContent>
//             {durations.map((item) => (
//               <SelectItem key={item.value} value={item.value}>
//                 {item.label}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       </div>
//     </div>
//   );
// }





"use client";
import { useId } from "react";
import { Plus, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const MAX_LENGTH = 25;

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
  const canRemoveOption = !readOnly && options.length > MIN_OPTIONS;

  return (
    <div
      className="my-2 mb-5 rounded-xl border border-border bg-muted/20 p-3.5"
      role="group"
      aria-label="X poll"
    >
      <ul className="flex flex-col gap-2">
        {options.map((option, index) => {
          const nearLimit = option.length >= MAX_LENGTH - 5;
          return (
            <li key={index} className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Input
                  aria-label={`Poll option ${index + 1}`}
                  placeholder={`Option ${index + 1}`}
                  maxLength={MAX_LENGTH}
                  value={option}
                  readOnly={readOnly}
                  className={cn(" rounded-lg bg-accent/4", nearLimit && "pr-12")}
                  onChange={(e) =>
                    change({
                      options: options.map((value, i) =>
                        i === index ? e.target.value : value,
                      ),
                    })
                  }
                />
                {nearLimit && !readOnly && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums",
                      option.length === MAX_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {option.length}/{MAX_LENGTH}
                  </span>
                )}
              </div>
              {canRemoveOption && (
                <button
                  type="button"
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() =>
                    change({ options: options.filter((_, i) => i !== index) })
                  }
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <X size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!readOnly && options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => change({ options: [...options, ""] })}
          className="mt-2 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <Plus size={14} />
          Add option
        </button>
      )}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
        <div className="flex items-center gap-2.5">
          <Label htmlFor={durationId} className="text-xs text-muted-foreground">
            Poll duration
          </Label>
          <Select
            items={durations}
            disabled={readOnly}
            value={String(poll.duration_minutes ?? 1440)}
            onValueChange={(value) =>
              value && change({ duration_minutes: Number(value) })
            }
          >
            <SelectTrigger
              id={durationId}
              aria-label="Poll duration"
              size="sm"
              className="bg-background"
            >
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
        {!readOnly && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              const next = { ...payload };
              delete next.poll;
              onChange(next);
            }}
          >
            Remove poll
          </Button>
        )}
      </div>
    </div>
  );
}