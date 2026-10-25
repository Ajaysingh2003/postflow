import type { Metadata } from "next";
import Script from "next/script";
import { seoMetadata, SITE_URL } from "@/lib/seo/config";
import { Newsreader, Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { Analytics } from "@vercel/analytics/next"
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
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WTLKW77V"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WTLKW77V');`}
        </Script>
        <Analytics/>
        <Script
          id="datafast-analytics"
          src="https://datafa.st/js/script.js"
          data-website-id="dfid_7Ertg27y4Sj7NdpyJnwCa"
          data-domain="draftva.com"
          strategy="afterInteractive"
          defer
        />
        <TRPCReactProvider>
          <Toaster />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
