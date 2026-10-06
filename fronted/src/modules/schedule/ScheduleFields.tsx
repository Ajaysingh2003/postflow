"use client";

import { Clock3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addDays, localDateTime } from "./calendarModel";

export default function ScheduleFields({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <div className="space-y-3">
    <Label htmlFor="publication-time" className="text-xs">Date and time</Label>
    <Input id="publication-time" aria-label="Schedule date and time" type="datetime-local" value={value} min={localDateTime(new Date())} onInput={(event) => onChange(event.currentTarget.value)} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full min-w-0 rounded-lg" />
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onChange(localDateTime(new Date(Date.now() + 3600000)))}>In one hour</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => { const date = addDays(new Date(), 1); date.setHours(9, 0, 0, 0); onChange(localDateTime(date)); }}>Tomorrow, 9 AM</Button>
    </div>
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
  </div>;
}
