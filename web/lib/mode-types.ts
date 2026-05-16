// Plain types shared by the server-only `lib/mode.ts`, the API route
// handler under `app/api/mode/space-catalog`, and the client-side
// catalog hook. No "server-only" guard here so the client can import
// the type definitions without dragging server code along.

import type { BriefListItem } from "@/lib/schemas";

export type ModeReport = { token: string; name: string };

// `used_by` is augmented server-side by the space-catalog endpoint
// from the brief YAML index. Optional because some consumers
// (existing BriefForm comboboxes) don't need it; the endpoint always
// populates it (possibly to `[]`) for the new landing.
export type ModeQuery = {
  token: string;
  name: string;
  used_by?: BriefListItem[];
};

export type ReportWithQueries = ModeReport & { queries: ModeQuery[] };
export type SpaceCatalog = { reports: ReportWithQueries[] };
