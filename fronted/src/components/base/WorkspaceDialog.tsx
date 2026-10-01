import React from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
function WorkspaceDialog({
  maxWidth = "520px",
  open,
  setOpen,
  children,
  label,
  isPending,
  handleSubmit,
  btnLabel,
  className,
}: {
  open: boolean;
  maxWidth?: string;
  setOpen: (e: boolean) => void;
  children: React.ReactNode;
  label: string;
  isPending: boolean;
  handleSubmit: () => void;
  btnLabel: string;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        style={maxWidth ? { maxWidth } : undefined}
        className={cn(
          "rounded-2xl w-[calc(100vw-2rem)] max-w-[540px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base sm:text-lg font-heading font-semibold text-neutral-900">
            {label}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 -mx-1 px-1">
          {children}
        </div>

        <DialogFooter className="flex shrink-0 items-center justify-end gap-2 pt-3 sm:justify-end border-t border-black/[0.06] mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-9 rounded-xl text-xs font-medium secondary-btn text-neutral-700 shadow-none hover:bg-neutral-50"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="h-9 rounded-xl bg-neutral-900 capitalize primary-btn text-xs font-medium text-white shadow-none hover:bg-neutral-800 disabled:opacity-50"
          >
            {btnLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkspaceDialog;
