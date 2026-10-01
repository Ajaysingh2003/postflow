"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Keep the first client render identical to SSR, then apply the preference.
export function useHydratedReducedMotion() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const reduced = useReducedMotion();
  return hydrated && !!reduced;
}
