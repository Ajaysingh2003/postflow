"use client";

import { useEffect } from "react";

import { useTRPCClient } from "@/trpc/client";

const LAST_REFRESH_KEY = "scanlyst_last_session_refresh";
const REFRESH_AFTER_MS = 10 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;

export default function SessionKeeper() {
  const client = useTRPCClient();

  useEffect(() => {
    let refreshing = false;
    let failures = 0;

    const refreshIfNeeded = async () => {
      if (refreshing || document.visibilityState !== "visible") return;
      const lastRefresh = Number(window.localStorage.getItem(LAST_REFRESH_KEY) || 0);
      if (Date.now() - lastRefresh < REFRESH_AFTER_MS) return;

      refreshing = true;
      window.localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
      try {
        await client.user.refresh.mutate();
        failures = 0;
        window.localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
      } catch {
        failures += 1;
        window.localStorage.removeItem(LAST_REFRESH_KEY);
        if (failures >= 2) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/login?reason=session_expired&next=${encodeURIComponent(next)}`);
        }
      } finally {
        refreshing = false;
      }
    };

    if (!window.localStorage.getItem(LAST_REFRESH_KEY)) {
      window.localStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
    }

    const interval = window.setInterval(refreshIfNeeded, CHECK_INTERVAL_MS);
    const handleVisibility = () => void refreshIfNeeded();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [client]);

  return null;
}
