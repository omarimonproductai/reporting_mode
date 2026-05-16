import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { CatalogBrowser } from "@/components/CatalogBrowser";
import { Skeleton } from "@/components/ui/skeleton";
import { buildCatalogUsageIndex } from "@/lib/catalogIndex";
import { listReportQueries, listSpaceReports } from "@/lib/mode";
import type { ReportWithQueries } from "@/lib/mode-types";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Mode space catalog
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Tots els reports del space Mode amb les seves queries i quins
        briefs els usen.
      </p>

      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogData />
      </Suspense>
    </div>
  );
}

async function CatalogData() {
  // Same shape the /api/mode/space-catalog endpoint returns, but
  // resolved server-side so the landing has no client-side fetch
  // dance on first paint. We call the underlying libs directly
  // instead of round-tripping our own HTTP route — same data, less
  // latency.
  let reports: ReportWithQueries[];
  try {
    const [rawReports, usageIndex] = await Promise.all([
      listSpaceReports(),
      buildCatalogUsageIndex(),
    ]);
    reports = await Promise.all(
      rawReports.map(async (report) => {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return <CatalogError message={message} />;
  }

  return <CatalogBrowser reports={reports} />;
}

function CatalogSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <Skeleton className="h-9 w-full" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

function CatalogError({ message }: { message: string }) {
  return (
    <div className="mt-10 rounded-lg border border-amber-200 bg-amber-50/60 px-6 py-8 text-center">
      <AlertTriangle className="mx-auto size-7 text-amber-500" />
      <h2 className="mt-3 text-sm font-medium text-zinc-900">
        Mode no disponible — torna a provar més tard
      </h2>
      <p className="mt-1 text-xs text-zinc-500">{message}</p>
      <p className="mt-3 text-xs text-zinc-500">
        Recarrega la pàgina per tornar a intentar-ho. La barra lateral
        i la resta de la plataforma continuen funcionant.
      </p>
    </div>
  );
}
