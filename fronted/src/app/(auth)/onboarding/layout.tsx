import { connection } from "next/server";
import type { ReactNode } from "react";

// Account-scoped screens must wait for a request, never a static build.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  await connection();
  return children;
}
