import React from "react";
import { cn } from "@/lib/utils";

interface MappingComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

function MappingComponent({
  children,
  className,
  ...props
}: MappingComponentProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col w-full h-full  bg-background border border-border rounded-2xl shadow-sm overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default MappingComponent;
