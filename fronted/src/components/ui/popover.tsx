"use client";

import { Popover as Primitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export function PopoverContent({
  align = "center",
  anchor,
  sideOffset = 6,
  className,
  children,
  ...props
}: Primitive.Popup.Props &
  Pick<Primitive.Positioner.Props, "align" | "anchor" | "sideOffset">) {
  return (
    <Primitive.Portal>
      <Primitive.Positioner
        anchor={anchor}
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <Primitive.Popup
          className={cn(
            "w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </Primitive.Popup>
      </Primitive.Positioner>
    </Primitive.Portal>
  );
}
