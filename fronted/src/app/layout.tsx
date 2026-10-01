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
  title: "Outlify | LinkedIn content, outreach & automation",
  description: "Create AI-powered LinkedIn posts, build and schedule content, and grow relationships with personalised outreach and automation.",
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
