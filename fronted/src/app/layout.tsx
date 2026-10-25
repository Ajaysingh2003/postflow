import type { Metadata } from "next";
import { seoMetadata, SITE_URL } from "@/lib/seo/config";
import { Newsreader, Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";

import { Toaster } from "@/components/ui/sonner";
const fontHeading = Newsreader({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const fontSubhead = Fraunces({
  preload: false,
  variable: "--font-subheading",
  subsets: ["latin"],
  display: "swap",
});
const fontContent = Manrope({
  variable: "--font-content",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  ...seoMetadata("/"),
  metadataBase: new URL(SITE_URL),
  // Canonicals belong to explicit page metadata, not unknown/404 routes.
  alternates: { canonical: null },
  title: {
    default: "AI Social Post Writer & Scheduler | Draftva",
    template: "%s | Draftva",
  },
  icons: {
    icon: "/images/brand/draftva-icon.png",
    apple: "/images/brand/draftva-apple-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontHeading.variable} ${fontSubhead.variable} ${fontContent.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TRPCReactProvider>
          <Toaster />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
