// Dodo prices have a shared 60-second backend cache; open pages refresh as well.
export const CATALOG_QUERY_OPTIONS = {
  staleTime: 15_000,
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
  retry: false,
} as const;
