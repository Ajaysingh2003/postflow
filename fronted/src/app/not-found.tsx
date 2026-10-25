import Link from "next/link";
import { PRIVATE_METADATA } from "@/lib/seo/config";

export const metadata = {
  ...PRIVATE_METADATA,
  title: { absolute: "Page not found | Draftva" },
};
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-4xl">Page not found</h1>
      <p className="text-muted-foreground">
        This page may have moved, or the address may be incorrect.
      </p>
      <nav
        aria-label="Find your way"
        className="flex flex-wrap justify-center gap-3"
      >
        <Link href="/" className="primary-btn rounded-lg">
          Draftva home
        </Link>
        <Link href="/product/ai-writer" className="secondary-btn rounded-lg">
          AI writing features
        </Link>
        <Link href="/pricing" className="secondary-btn rounded-lg">
          Plans and pricing
        </Link>
      </nav>
    </main>
  );
}
