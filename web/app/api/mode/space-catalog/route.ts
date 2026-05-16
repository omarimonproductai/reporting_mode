import { NextResponse } from "next/server";
import { buildCatalogUsageIndex } from "@/lib/catalogIndex";
import { listReportQueries, listSpaceReports } from "@/lib/mode";
import type { ReportWithQueries, SpaceCatalog } from "@/lib/mode-types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  fetchedAt: number;
  data: SpaceCatalog;
};

// Single-entry cache: there's only one space configured at a time via
// MODE_SPACE env var. If MODE_SPACE changes we want to refetch
// immediately, so we key the cache by the space id.
const cache = new Map<string, CacheEntry>();

export async function GET(request: Request): Promise<NextResponse> {
  const space = process.env.MODE_SPACE ?? "";
  const force = new URL(request.url).searchParams.get("force") === "true";
  const now = Date.now();

  const cached = cache.get(space);
  if (!force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cached.data,
      cached: true,
      fetched_at: cached.fetchedAt,
    });
  }

  try {
    // Fetch the Mode catalog and the brief usage index in parallel.
    // The usage index is local (briefs/*.yml) so it always succeeds
    // fast; Mode is the slow side. We Promise.all them to overlap the
    // I/O instead of waiting sequentially.
    const [reports, usageIndex] = await Promise.all([
      listSpaceReports(),
      buildCatalogUsageIndex(),
    ]);
    // Fetch every report's queries in parallel. For a Cooltra-sized
    // space this is a handful of requests; if the space grows large
    // enough to hit rate limits we can shard or paginate later.
    const reportsWithQueries: ReportWithQueries[] = await Promise.all(
      reports.map(async (report) => {
        const queries = await listReportQueries(report.token);
        return {
          ...report,
          queries: queries.map((q) => ({
            ...q,
            used_by: usageIndex.get(q.token) ?? [],
          })),
        };
      })
    );
    const data: SpaceCatalog = { reports: reportsWithQueries };
    cache.set(space, { fetchedAt: now, data });
    return NextResponse.json({ ...data, cached: false, fetched_at: now });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
