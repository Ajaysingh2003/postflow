import { PRIVATE_METADATA } from "@/lib/seo/config";
import type { ReactNode } from "react";
import { CardWrapper } from "@/components/base/AuthCardWrapper";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid bg-[#faf9f5z]">
      <div className="flex w-full items-center justify-center overflow-hidden">
        <div className="w-full rounded-xl border border-border shadow-sm">
          <CardWrapper>{children}</CardWrapper>
        </div>
      </div>
    </div>
  );
}

export const metadata = PRIVATE_METADATA;
