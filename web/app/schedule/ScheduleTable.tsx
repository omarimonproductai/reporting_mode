"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  XCircle,
} from "lucide-react";
import {
  formatCatalunyaDateTime,
  humanize,
  relativeFromNow,
  relativeFromPast,
} from "@/lib/cron";
import type { BriefListItemWithRun } from "@/lib/briefs";
import { DraftChip } from "@/components/DraftChip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ScheduleRow = {
  brief: BriefListItemWithRun;
  next: Date | null;
};

type Props = {
  rows: ScheduleRow[];
};

type SortField = "name" | "next" | "lastrun";
type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortField, SortDir> = {
  name: "asc",
  next: "asc",
  lastrun: "desc",
};

function lastRunTimeMs(brief: BriefListItemWithRun): number | null {
  if (brief.run.kind !== "ready") return null;
  const r = brief.run.record;
  const iso = r.finished_at ?? r.started_at;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function compareRow(a: ScheduleRow, b: ScheduleRow, field: SortField): number {
  switch (field) {
    case "name":
      return a.brief.name.localeCompare(b.brief.name, "ca");
    case "next":
      if (a.next && b.next) return a.next.getTime() - b.next.getTime();
      // never-here-handled: both nulls case is caught upstream by partitioning.
      return 0;
    case "lastrun": {
      const at = lastRunTimeMs(a.brief);
      const bt = lastRunTimeMs(b.brief);
      if (at !== null && bt !== null) return at - bt;
      return 0;
    }
  }
}

function hasSortValue(row: ScheduleRow, field: SortField): boolean {
  switch (field) {
    case "name":
      return true;
    case "next":
      return row.next !== null;
    case "lastrun":
      return lastRunTimeMs(row.brief) !== null;
  }
}

function sortRows(
  rows: ScheduleRow[],
  field: SortField,
  dir: SortDir
): ScheduleRow[] {
  // Partition so rows missing a sortable value always sink to the bottom,
  // independent of asc/desc — same convention we used in the pre-sortable
  // server-side renderer.
  const valid: ScheduleRow[] = [];
  const invalid: ScheduleRow[] = [];
  for (const row of rows) {
    if (hasSortValue(row, field)) valid.push(row);
    else invalid.push(row);
  }
  valid.sort((a, b) => {
    const cmp = compareRow(a, b, field);
    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    // Tiebreak alphabetically — stable across directions.
    return a.brief.name.localeCompare(b.brief.name, "ca");
  });
  invalid.sort((a, b) =>
    a.brief.name.localeCompare(b.brief.name, "ca")
  );
  return [...valid, ...invalid];
}

export function ScheduleTable({ rows }: Props) {
  const [sortField, setSortField] = useState<SortField>("next");
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_DIR.next);

  const sorted = useMemo(
    () => sortRows(rows, sortField, sortDir),
    [rows, sortField, sortDir]
  );

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(DEFAULT_DIR[field]);
    }
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
            <SortableHeader
              label="Brief"
              field="name"
              activeField={sortField}
              dir={sortDir}
              onClick={toggleSort}
            />
            <SortableHeader
              label="Proper enviament"
              field="next"
              activeField={sortField}
              dir={sortDir}
              onClick={toggleSort}
            />
            <th className="px-4 py-3 font-medium">Schedule</th>
            <SortableHeader
              label="Última run"
              field="lastrun"
              activeField={sortField}
              dir={sortDir}
              onClick={toggleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ brief, next }) => (
            <tr key={brief.filename} className="border-t border-zinc-100">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/briefs/${brief.filename}`}
                    className={cn(
                      "font-medium text-zinc-900 hover:underline",
                      !brief.published && "opacity-60"
                    )}
                  >
                    {brief.name}
                  </Link>
                  {!brief.published && <DraftChip />}
                </div>
              </td>
              <td className="px-4 py-3">
                {next ? (
                  brief.published ? (
                    <NextFireCell date={next} />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-block opacity-60">
                          <NextFireCell date={next} />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        Aquest brief està despublicat — el cron no
                        s&apos;aplicarà fins que es publiqui.
                      </TooltipContent>
                    </Tooltip>
                  )
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
              <td className="px-4 py-3">
                <LastRunCell brief={brief} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  dir,
  onClick,
  align,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  dir: SortDir;
  onClick: (field: SortField) => void;
  align?: "right";
}) {
  const isActive = activeField === field;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onClick(field)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors",
          "text-zinc-500 hover:text-zinc-900",
          align === "right" && "ml-auto"
        )}
      >
        {label}
        <span className="inline-flex size-3 shrink-0 items-center justify-center">
          {isActive ? (
            dir === "asc" ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )
          ) : (
            <ChevronDown className="size-3 opacity-0 group-hover:opacity-30" />
          )}
        </span>
      </button>
    </th>
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

function LastRunCell({ brief }: { brief: BriefListItemWithRun }) {
  if (brief.run.kind === "never-run") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
          <MinusCircle className="size-3.5" />
          Mai executat
        </span>
      </div>
    );
  }
  const r = brief.run.record;
  const ok = r.status === "success";
  const iso = r.finished_at ?? r.started_at;
  const date = new Date(iso);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          ok ? "text-emerald-700" : "text-red-700"
        )}
      >
        {ok ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <XCircle className="size-3.5" />
        )}
        {ok ? "Èxit" : "Error"}
      </span>
      <span className="text-[11px] text-zinc-500 font-mono">
        {relativeFromPast(date)} · {formatCatalunyaDateTime(date)}
      </span>
    </div>
  );
}
