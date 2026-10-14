"use client";

import {
  createContext,
  useContext,
  Suspense,
  type ReactNode,
  type ComponentProps,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  settingsHref,
  settingsSection,
  settingsUrl,
  type SettingsSection,
} from "./model";

const SettingsDialog = dynamic(() => import("./SettingsDialog"), {
  ssr: false,
});
const SettingsContext = createContext<
  ((section: SettingsSection) => void) | null
>(null);

function SettingsHost({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const section = settingsSection(params.get("settings"));
  function select(value: SettingsSection | null) {
    window.history.replaceState(
      null,
      "",
      settingsUrl(new URL(window.location.href), value),
    );
  }
  return (
    <SettingsContext.Provider value={select}>
      {children}
      {section && (
        <SettingsDialog
          section={section}
          onSelect={select}
          onClose={() => select(null)}
        />
      )}
    </SettingsContext.Provider>
  );
}
export function SettingsProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <SettingsHost>{children}</SettingsHost>
    </Suspense>
  );
}
export function SettingsLink({
  section = "profile",
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { section?: SettingsSection }) {
  const open = useContext(SettingsContext);
  return (
    <Link
      {...props}
      href={settingsHref(section)}
      onClick={(event) => {
        onClick?.(event);
        if (
          open &&
          !event.defaultPrevented &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        ) {
          event.preventDefault();
          open(section);
        }
      }}
    />
  );
}
