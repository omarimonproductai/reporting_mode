// Plain types shared by the server-only `lib/mode.ts`, the API route
// handler under `app/api/mode/space-catalog`, and the client-side
// catalog hook. No "server-only" guard here so the client can import
// the type definitions without dragging server code along.

export type ModeReport = { token: string; name: string };
export type ModeQuery = { token: string; name: string };

export type ReportWithQueries = ModeReport & { queries: ModeQuery[] };
export type SpaceCatalog = { reports: ReportWithQueries[] };
