// src/modules/user/component/GenerateAvartar.tsx

import React, { useMemo } from "react";
import { Style, Avatar as DiceBearAvatar } from "@dicebear/core";

import botttsNeutralDefinition from "@dicebear/styles/bottts-neutral.json" with { type: "json" };
import initialsDefinition from "@dicebear/styles/initials.json" with { type: "json" };

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const botttsNeutralStyle = new Style(botttsNeutralDefinition);
const initialsStyle = new Style(initialsDefinition);

interface Props {
  seed?: string | null;
  className?: string;
  variant?: "botttsNeutral" | "initials";
  isCircle?: boolean;
}

export default function GenerateAvatar({
  seed,
  className,
  variant = "botttsNeutral",
  isCircle = false,
}: Props) {
  const avatarUri = useMemo(() => {
    if (!seed) return "";

    const selectedStyle =
      variant === "botttsNeutral" ? botttsNeutralStyle : initialsStyle;

    const options: Record<string, any> =
      variant === "botttsNeutral"
        ? { seed }
        : {
            seed,
            fontWeight: 500,
          };

    try {
      return new DiceBearAvatar(selectedStyle, options).toDataUri();
    } catch (err) {
      console.error("DiceBear error:", err);
      return "";
    }
  }, [seed, variant]);

  if (!seed) return null;

  return (
    <Avatar className={cn(isCircle ? "rounded-full" : "rounded-sm", className)}>
      <AvatarImage
        className={cn(isCircle ? "rounded-full" : "rounded-sm")}
        src={avatarUri}
        alt={`${seed} avatar`}
      />
      <AvatarFallback className={cn(isCircle ? "rounded-full" : "rounded-sm")}>
        {seed.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}