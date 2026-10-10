import type { Metadata } from "next";
import { Newsreader, Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";

import { Toaster } from "@/components/ui/sonner";
const fontHeading = Newsreader({
  variable: "--font-heading",
  subsets: ["latin"],
});

const fontSubhead = Fraunces({
  variable: "--font-subheading",
  subsets: ["latin"],
});
const fontContent = Manrope({
  variable: "--font-content",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Draftva | Multi-channel social scheduling & writing platform",
  description: "Create, schedule, and publish posts across X, LinkedIn, Reddit, Bluesky, Threads, and Meta with an intelligent writing assistant.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontHeading.variable} ${fontSubhead.variable} ${fontContent.variable} h-full antialiased`}
    >
      <TRPCReactProvider>

      <body className="min-h-full flex flex-col">
        <Toaster/>
        {children}
      </body>
      </TRPCReactProvider>
    </html>
  );
}
