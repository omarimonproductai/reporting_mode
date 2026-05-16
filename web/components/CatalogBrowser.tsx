"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReportWithQueries } from "@/lib/mode-types";

type Props = {
  reports: ReportWithQueries[];
};

export function CatalogBrowser({ reports }: Props) {
  const [query, setQuery] = useState("");
  // Map of report token → set of query tokens whose badge has been
  // inline-expanded by the user. We key by both so a query token
  // accidentally shared across reports (shouldn't happen, but cheap to
  // guard) doesn't collapse independently of the matching context.
  const [expandedBadges, setExpandedBadges] = useState<Set<string>>(
    () => new Set()
  );

  const trimmed = query.trim().toLowerCase();

  // Filtered view: when the search is active, hide reports that don't
  // match by name AND whose queries don't match by name/token. Auto-
  // expand reports with a query match.
  const filtered = useMemo(() => {
    if (!trimmed) {
      return reports.map((r) => ({
        report: r,
        queries: r.queries,
        autoOpen: false,
      }));
    }
    const out: { report: ReportWithQueries; queries: typeof reports[number]["queries"]; autoOpen: boolean }[] = [];
    for (const report of reports) {
      const reportMatches =
        report.name.toLowerCase().includes(trimmed) ||
        report.token.toLowerCase().includes(trimmed);
      const matchingQueries = report.queries.filter(
        (q) =>
          q.name.toLowerCase().includes(trimmed) ||
          q.token.toLowerCase().includes(trimmed)
      );
      const queryMatched = matchingQueries.length > 0;
      if (!reportMatches && !queryMatched) continue;
      out.push({
        report,
        // If the search matched a query inside the report, show only
        // those queries (the hit). If only the report name matched,
        // show all its queries.
        queries: queryMatched ? matchingQueries : report.queries,
        autoOpen: queryMatched,
      });
    }
    return out;
  }, [reports, trimmed]);

  // Compute the controlled `value` for the Accordion. When search is
  // empty we use uncontrolled defaults (everything closed). When
  // search is non-empty we force-open the reports whose queries
  // matched, surfacing the hit without an extra click.
  const accordionValue = useMemo(() => {
    if (!trimmed) return undefined;
    return filtered.filter((f) => f.autoOpen).map((f) => f.report.token);
  }, [filtered, trimmed]);

  function toggleBadge(reportToken: string, queryToken: string) {
    const key = `${reportToken}::${queryToken}`;
    setExpandedBadges((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (reports.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center">
        <p className="text-sm text-zinc-500">
          Cap report al space Mode configurat.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca reports o queries per nom o token…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && trimmed ? (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-10 text-center text-sm text-zinc-500">
          Cap report o query coincideix amb «{trimmed}».
        </div>
      ) : (
        <Accordion
          type="multiple"
          className="mt-4"
          value={accordionValue}
          // When search is empty, value is undefined → uncontrolled
          // (defaults to all closed). When search is non-empty, we
          // force-open via the `value` prop above. onValueChange is a
          // no-op in the controlled case (matching reports stay open
          // for the duration of the search) and unused otherwise.
        >
          {filtered.map(({ report, queries }) => (
            <AccordionItem
              key={report.token}
              value={report.token}
              className="border-b border-zinc-200 last:border-b-0"
            >
              <AccordionTrigger className="py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  <span className="truncate text-sm font-medium text-zinc-900">
                    {report.name}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    {report.token}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="flex flex-col gap-2 py-2">
                  {queries.map((q) => {
                    const badgeOpen = expandedBadges.has(
                      `${report.token}::${q.token}`
                    );
                    const count = q.used_by?.length ?? 0;
                    return (
                      <li
                        key={q.token}
                        className="rounded-md border border-zinc-100 bg-zinc-50/60 px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-zinc-900">
                              {q.name}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-500">
                              {q.token}
                            </div>
                          </div>
                          <UsageBadge
                            count={count}
                            open={badgeOpen}
                            onClick={() =>
                              toggleBadge(report.token, q.token)
                            }
                          />
                          {count === 0 && (
                            <Link
                              href={`/briefs/new?prefill_report=${report.token}`}
                              className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-zinc-500 transition-colors hover:text-zinc-900"
                            >
                              <Plus className="size-3" />
                              Create brief
                            </Link>
                          )}
                        </div>
                        {badgeOpen && count > 0 && (
                          <ul className="mt-2 flex flex-col gap-1 border-t border-zinc-200 pt-2 pl-1">
                            {q.used_by!.map((b) => (
                              <li key={b.filename}>
                                <Link
                                  href={`/briefs/${b.filename}`}
                                  className="text-xs text-zinc-700 hover:text-zinc-900 hover:underline"
                                >
                                  {b.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

function UsageBadge({
  count,
  open,
  onClick,
}: {
  count: number;
  open: boolean;
  onClick: () => void;
}) {
  if (count === 0) {
    return (
      <span className="whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-400">
        0 briefs
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] transition-colors",
        open
          ? "bg-zinc-900 text-white"
          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      )}
    >
      {open ? "amaga" : `usat per ${count} brief${count === 1 ? "" : "s"}`}
    </button>
  );
}
