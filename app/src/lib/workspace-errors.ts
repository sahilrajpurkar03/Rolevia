type QueryResult = { error: { code?: string } | null; status: number };
type WorkspaceResults = Record<
  "profiles" | "matches" | "applications" | "check_runs",
  QueryResult
>;
const knownCodes = new Set([
  "42501",
  "42P01",
  "42703",
  "PGRST205",
  "PGRST204",
  "PGRST301",
  "PGRST302",
  "PGRST303",
  "PGRST116",
]);

export function workspaceFailures(results: WorkspaceResults) {
  return Object.entries(results).flatMap(([query, result]) =>
    result.error
      ? [
          {
            query,
            status: result.status,
            code: knownCodes.has(result.error.code ?? "")
              ? result.error.code
              : "unknown",
          },
        ]
      : [],
  );
}
