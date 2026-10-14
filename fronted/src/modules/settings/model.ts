export const SETTINGS_SECTIONS = [
  "profile",
  "security",
  "billing",
  "team",
  "channels",
  "agents",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export function settingsSection(value: string | null): SettingsSection | null {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
    ? (value as SettingsSection)
    : null;
}
export function settingsHref(section: SettingsSection = "profile") {
  return `/dashboard?settings=${section}`;
}
export function settingsUrl(url: URL, section: SettingsSection | null) {
  const next = new URL(url);
  if (section) next.searchParams.set("settings", section);
  else {
    next.searchParams.delete("settings");
    next.searchParams.delete("checkout");
  }
  return `${next.pathname}${next.search}${next.hash}`;
}
export function canManageTeam(role?: string) {
  return role === "owner" || role === "admin";
}
export function canEditMember(
  actor: string | undefined,
  memberRole: string,
  own: boolean,
) {
  return (
    canManageTeam(actor) &&
    !own &&
    memberRole !== "owner" &&
    !(actor === "admin" && memberRole === "admin")
  );
}
