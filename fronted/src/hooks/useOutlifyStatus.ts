// useOutlifyStatus.ts
import { useCallback, useEffect, useState } from "react";
import { isExtensionInstalled } from "@/lib/linkedinBridge";

export function useOutlifyStatus() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkStatus = useCallback(() => {
    // 1. Direct DOM indicator check
    if (isExtensionInstalled()) {
      setIsInstalled(true);
      window.postMessage({ type: "Outlify_CHECK_AUTH" }, "*");
    } else {
      // 2. Ping via postMessage
      window.postMessage({ type: "Outlify_PING" }, "*");
    }
  }, []);

  useEffect(() => {
    let pingInterval: NodeJS.Timeout | null = null;
    let fallbackTimeout: NodeJS.Timeout | null = null;
    let observer: MutationObserver | null = null;

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;

      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (_) {
          return;
        }
      }

      // Extension is alive
      if (data?.type === "Outlify_PONG") {
        setIsInstalled(true);
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        // Once confirmed installed, check LinkedIn auth
        window.postMessage({ type: "Outlify_CHECK_AUTH" }, "*");
      }

      // LinkedIn auth status returned
      if (data?.type === "Outlify_AUTH_RESULT") {
        setIsInstalled(true);
        setIsSignedIn(Boolean(data.authenticated));
        setIsChecking(false);
      }
    };

    window.addEventListener("message", handleMessage);

    // Initial check
    if (isExtensionInstalled()) {
      setIsInstalled(true);
      window.postMessage({ type: "Outlify_CHECK_AUTH" }, "*");
    } else {
      window.postMessage({ type: "Outlify_PING" }, "*");
    }

    // Repeated pinging for up to 3 seconds in case content script initializes slightly after Next.js hydration
    let pingsSent = 0;
    pingInterval = setInterval(() => {
      pingsSent++;
      if (isExtensionInstalled()) {
        setIsInstalled(true);
        window.postMessage({ type: "Outlify_CHECK_AUTH" }, "*");
        if (pingInterval) clearInterval(pingInterval);
        return;
      }
      window.postMessage({ type: "Outlify_PING" }, "*");
      if (pingsSent >= 10 && pingInterval) {
        clearInterval(pingInterval);
      }
    }, 300);

    // Observe DOM mutations in case content script appends indicator element
    try {
      observer = new MutationObserver(() => {
        if (isExtensionInstalled()) {
          setIsInstalled(true);
          window.postMessage({ type: "Outlify_CHECK_AUTH" }, "*");
          if (pingInterval) clearInterval(pingInterval);
          if (observer) observer.disconnect();
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (_) {}

    // Fallback: If no response after 3 seconds, finish checking
    fallbackTimeout = setTimeout(() => {
      setIsChecking(false);
      if (isExtensionInstalled()) {
        setIsInstalled(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener("message", handleMessage);
      if (pingInterval) clearInterval(pingInterval);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (observer) observer.disconnect();
    };
  }, []);

  return { isInstalled, isSignedIn, isChecking, refetch: checkStatus };
}