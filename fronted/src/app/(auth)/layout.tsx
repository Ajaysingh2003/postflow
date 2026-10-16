import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CardWrapper } from "@/components/base/AuthCardWrapper";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};
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
