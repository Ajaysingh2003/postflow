"use client";

import { reloadAuthPage } from "../authFlow";

import { useEffect } from "react";
import { useTRPCClient } from "@/trpc/client";
import { verificationPath } from "../authFlow";

export default function SessionKeeper() {
  const client = useTRPCClient();
  useEffect(() => {
    let refreshing = false;
    let lastCheck = Date.now();
    const check = async () => {
      if (
        refreshing ||
        document.visibilityState !== "visible" ||
        Date.now() - lastCheck < 600_000
      )
        return;
      refreshing = true;
      lastCheck = Date.now();
      try {
        const session = await client.user.refresh.mutate();
        if (session.verification_required)
          reloadAuthPage(
            verificationPath(
              session.user.email,
              window.location.pathname + window.location.search,
            ),
          );
      } catch (error) {
        // Network outages or rate limits never silently sign out a valid user.
        if (
          (error as { data?: { code?: string } }).data?.code === "UNAUTHORIZED"
        ) {
          reloadAuthPage(
            "/login?reason=session_expired&next=" +
              encodeURIComponent(
                window.location.pathname + window.location.search,
              ),
          );
        }
      } finally {
        refreshing = false;
      }
    };
    const interval = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
  }, [client]);
  return null;
}
