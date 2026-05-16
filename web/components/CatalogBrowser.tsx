"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Database, Plus, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BriefListItem } from "@/lib/schemas";
import type { ReportWithQueries } from "@/lib/mode-types";

type Props = {
  reports: ReportWithQueries[];
};

export function CatalogBrowser({ reports }: Props) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) {
      return reports.map((r) => ({
        report: r,
        queries: r.queries,
        autoOpen: false,
      }));
    }
    const out: {
      report: ReportWithQueries;
      queries: typeof reports[number]["queries"];
      autoOpen: boolean;
    }[] = [];
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
        queries: queryMatched ? matchingQueries : report.queries,
        autoOpen: queryMatched,
      });
    }
    return out;
  }, [reports, trimmed]);

  const accordionValue = useMemo(() => {
    if (!trimmed) return undefined;
    return filtered.filter((f) => f.autoOpen).map((f) => f.report.token);
  }, [filtered, trimmed]);

  const totalQueries = reports.reduce(
    (acc, r) => acc + r.queries.length,
    0
  );
  const usedQueries = reports.reduce(
    (acc, r) =>
      acc + r.queries.filter((q) => (q.used_by?.length ?? 0) > 0).length,
    0
  );

  if (reports.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-8 py-12 text-center">
        <Database className="mx-auto size-8 text-zinc-400" />
        <p className="mt-3 text-sm text-zinc-500">
          Cap report al space Mode configurat.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>
          <strong className="font-medium text-zinc-900">
            {reports.length}
          </strong>{" "}
          reports
        </span>
        <span className="text-zinc-300">·</span>
        <span>
          <strong className="font-medium text-zinc-900">
            {totalQueries}
          </strong>{" "}
          queries
        </span>
        <span className="text-zinc-300">·</span>
        <span>
          <strong className="font-medium text-zinc-900">
            {usedQueries}
          </strong>{" "}
          en ús per algun brief
        </span>
      </div>

      <div className="relative mt-4">
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
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-10 text-center text-sm text-zinc-500">
          Cap report o query coincideix amb «{trimmed}».
        </div>
      ) : (
        <Accordion type="multiple" className="mt-5 gap-3" value={accordionValue}>
          {filtered.map(({ report, queries }) => (
            <ReportCard
              key={report.token}
              report={report}
              queries={queries}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}

function uniqueBriefCount(report: ReportWithQueries): number {
  const filenames = new Set<string>();
  for (const q of report.queries) {
    for (const b of q.used_by ?? []) {
      filenames.add(b.filename);
    }
  }
  return filenames.size;
}

function ReportCard({
  report,
  queries,
}: {
  report: ReportWithQueries;
  queries: ReportWithQueries["queries"];
}) {
  const briefCount = uniqueBriefCount(report);
  return (
    <AccordionItem
      value={report.token}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md data-[state=open]:shadow-md"
    >
      <AccordionTrigger className="rounded-none border-0 px-5 py-4 hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            <Database className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-zinc-900">
              {report.name}
            </h3>
            <p className="mt-0.5 font-mono text-xs text-zinc-400">
              {report.token}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="secondary"
              className="rounded-full bg-zinc-100 font-normal text-zinc-600"
            >
              {report.queries.length}{" "}
              {report.queries.length === 1 ? "query" : "queries"}
            </Badge>
            {briefCount > 0 ? (
              <Badge
                variant="secondary"
                className="rounded-full bg-emerald-50 font-normal text-emerald-700"
              >
                {briefCount} {briefCount === 1 ? "brief" : "briefs"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="rounded-full border-zinc-200 font-normal text-zinc-400"
              >
                0 briefs
              </Badge>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-0">
        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
          {queries.length === 0 ? (
            <p className="text-xs italic text-zinc-400">
              Aquest report no té queries.
            </p>
          ) : (
            queries.map((q) => (
              <QueryRow
                key={q.token}
                name={q.name}
                token={q.token}
                consumers={q.used_by ?? []}
                reportToken={report.token}
              />
            ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function QueryRow({
  name,
  token,
  consumers,
  reportToken,
}: {
  name: string;
  token: string;
  consumers: BriefListItem[];
  reportToken: string;
}) {
  const count = consumers.length;
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 transition-colors hover:bg-zinc-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-900">{name}</p>
          <p className="mt-0.5 font-mono text-xs text-zinc-400">{token}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {count === 0 ? (
            <>
              <Badge
                variant="outline"
                className="rounded-full border-zinc-200 font-normal text-zinc-400"
              >
                0 briefs
              </Badge>
              <Button asChild size="xs" variant="ghost">
                <Link href={`/briefs/new?prefill_report=${reportToken}`}>
                  <Plus />
                  Create brief
                </Link>
              </Button>
            </>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 data-[state=open]:bg-zinc-900 data-[state=open]:text-white"
                >
                  <span>
                    usat per {count} brief{count === 1 ? "" : "s"}
                  </span>
                  <ChevronDown className="size-3 transition-transform data-[state=open]:rotate-180" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-3"
                align="end"
                sideOffset={6}
              >
                <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
                  Briefs que usen aquesta query
                </p>
                <ul className="space-y-1">
                  {consumers.map((b) => (
                    <li key={b.filename}>
                      <Link
                        href={`/briefs/${b.filename}`}
                        className="inline-flex items-center gap-1.5 text-sm text-zinc-700 transition-colors hover:text-zinc-900 hover:no-underline"
                      >
                        <ArrowRight className="size-3 text-zinc-400" />
                        {b.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
    </div>
  );
}
