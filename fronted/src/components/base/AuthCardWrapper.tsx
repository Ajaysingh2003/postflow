"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CardWrapperProps {
  children: React.ReactNode;
  backHref?: string; // Optional direct path fallback
}

export function CardWrapper({ children, backHref }: CardWrapperProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className="bg-backgroundz border  border-border rounded-xl shadow-mdz p-2">
      {/* Top action row */}
      <div className="mb-4 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="h-8 gap-1.5 px-2 text-xs hover:bg-transparent  bg-transparent text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back</span>
        </Button>
      </div>

      {/* Rendered content */}
      {children}
    </div>
  );
}