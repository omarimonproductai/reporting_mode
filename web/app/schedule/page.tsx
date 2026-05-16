import Link from "next/link";
import { Suspense } from "react";
import { CalendarClock, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getBriefListWithRuns, type BriefListItemWithRun } from "@/lib/briefs";
import {
  formatCatalunyaDateTime,
  humanize,
  nextFireAt,
  relativeFromNow,
} from "@/lib/cron";
export const dynamic = "force-dynamic";

export default function SchedulePage() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Schedule</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Briefs ordenats pel proper enviament en horari Catalunya.
      </p>

      <Suspense fallback={<ScheduleSkeleton />}>
        <ScheduleTable />
      </Suspense>
    </div>
  );
}

async function ScheduleTable() {
  const briefs = await getBriefListWithRuns();
  const rows = briefs
    .map((b) => ({ brief: b, next: nextFireAt(b.schedule) }))
    .sort((a, b) => {
      if (!a.next && !b.next)
        return a.brief.name.localeCompare(b.brief.name, "ca");
      if (!a.next) return 1;
      if (!b.next) return -1;
      return a.next.getTime() - b.next.getTime();
    });

  if (rows.length === 0 || rows.every((r) => r.next === null)) {
    return <EmptyState hasBriefs={rows.length > 0} />;
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">Brief</th>
            <th className="px-4 py-3">Proper enviament</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3 text-right">Última run</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ brief, next }) => (
            <tr key={brief.filename} className="border-t border-zinc-100">
              <td className="px-4 py-3">
                <Link
                  href={`/briefs/${brief.filename}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {brief.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                {next ? (
                  <NextFireCell date={next} />
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-600">
                {humanize(brief.schedule) ?? (
                  <span className="font-mono text-xs text-zinc-400">
                    {brief.schedule}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <LastRunCell run={brief.run} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NextFireCell({ date }: { date: Date }) {
  return (
    <div className="flex flex-col">
      <span className="text-zinc-900">{relativeFromNow(date)}</span>
      <span className="text-xs text-zinc-500 font-mono">
        {formatCatalunyaDateTime(date)}
      </span>
    </div>
  );
}

function LastRunCell({ run }: { run: BriefListItemWithRun["run"] }) {
  if (run.kind === "never-run") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
        <MinusCircle className="size-3.5" />
        Mai executat
      </span>
    );
  }
  const ok = run.record.status === "success";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        ok ? "text-emerald-700" : "text-red-700"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <XCircle className="size-3.5" />
      )}
      {ok ? "Èxit" : "Error"}
    </span>
  );
}

function EmptyState({ hasBriefs }: { hasBriefs: boolean }) {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center">
      <CalendarClock className="mx-auto size-8 text-zinc-400" />
      <h2 className="mt-3 text-sm font-medium text-zinc-900">
        Cap execució programada properament
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        {hasBriefs
          ? "Cap dels briefs té un schedule vàlid. Edita'n algun per assignar-li un cron."
          : "Crea el primer brief des de la barra lateral."}
      </p>
    </div>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <Skeleton className="h-3 w-32" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-4 gap-4 border-t border-zinc-100 px-4 py-3"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
