export function allowedMutationOrigin(
  origin: string | null,
  requestUrl: string,
  host: string | null,
  fetchSite: string | null,
) {
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;
  try {
    const source = new URL(origin);
    return (
      ["http:", "https:"].includes(source.protocol) &&
      (source.origin === new URL(requestUrl).origin || source.host === host)
    );
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request) {
  return allowedMutationOrigin(
    request.headers.get("origin"),
    request.url,
    request.headers.get("host"),
    request.headers.get("sec-fetch-site"),
  );
}
