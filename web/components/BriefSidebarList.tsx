"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefRowMenu } from "@/components/BriefRowMenu";
import { DraftChip } from "@/components/DraftChip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BriefListItemWithRun } from "@/lib/briefs";
import type { RunLookup } from "@/lib/runs";
import { outputTokenColorClass } from "@/lib/tokenWarnings";

// Heuristic: with the 280px sidebar at Inter text-sm, a name longer
// than ~28 characters won't fit before the truncation ellipsis kicks
// in. Coarser than DOM measurement but reliable across font-loading
// races. Tune if the sidebar width changes.
const TRUNCATE_THRESHOLD = 28;

export function BriefSidebarList({
  briefs,
}: {
  briefs: BriefListItemWithRun[];
}) {
  const pathname = usePathname();

  if (briefs.length === 0) {
    return (
      <div className="px-2 text-xs text-zinc-400">
        Cap brief encara. Crea&apos;n el primer.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {briefs.map((brief) => {
        const href = `/briefs/${brief.filename}`;
        const isActive = pathname === href;
        return (
          <BriefRow
            key={brief.filename}
            brief={brief}
            href={href}
            isActive={isActive}
          />
        );
      })}
    </ul>
  );
}

function BriefRow({
  brief,
  href,
  isActive,
}: {
  brief: BriefListItemWithRun;
  href: string;
  isActive: boolean;
}) {
  const isTruncated = brief.name.length > TRUNCATE_THRESHOLD;

  // `pr-9` reserves space on the right for the absolutely-positioned
  // kebab button so the brief name never visually slides under it.
  const link = (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-0.5 rounded-md py-1.5 pl-2 pr-9 text-sm text-zinc-700 transition-colors",
        isActive
          ? "bg-zinc-100 font-medium text-zinc-900"
          : "hover:bg-zinc-100"
      )}
    >
      <div className="flex items-center gap-1.5">
        <StatusIcon run={brief.run} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !brief.published && "opacity-60"
          )}
        >
          {brief.name}
        </span>
        {!brief.published && <DraftChip />}
      </div>
      <RunMeta run={brief.run} />
    </Link>
  );

  const row = (
    <div className="group relative">
      {isTruncated ? (
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{brief.name}</TooltipContent>
        </Tooltip>
      ) : (
        link
      )}
      <div className="absolute right-1 top-1 z-10">
        <BriefRowMenu
          filename={brief.filename}
          published={brief.published}
          briefName={brief.name}
        />
      </div>
    </div>
  );

  return <li>{row}</li>;
}

function StatusIcon({ run }: { run: RunLookup }) {
  if (run.kind === "never-run") {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-zinc-300"
        aria-label="Mai executat"
        title="Mai executat"
      />
    );
  }
  const ok = run.record.status === "success";
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        ok ? "bg-emerald-500" : "bg-red-500"
      )}
      aria-label={ok ? "Last run: success" : "Last run: failed"}
      title={ok ? "Last run: success" : "Last run: failed"}
    />
  );
}

function RunMeta({ run }: { run: RunLookup }) {
  if (run.kind === "never-run") {
    return <span className="pl-3.5 text-[11px] text-zinc-400">Mai executat</span>;
  }
  const r = run.record;
  const when = relativeTime(r.finished_at ?? r.started_at);
  const tokens = r.tokens;
  return (
    <span className="flex items-center gap-2 pl-3.5 text-[11px] text-zinc-500">
      <span>{when}</span>
      {tokens && (
        <span className="font-mono text-zinc-400">
          {formatK(tokens.input)} +{" "}
          <span className={outputTokenColorClass(tokens.output)}>
            {formatK(tokens.output)}
          </span>
        </span>
      )}
    </span>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "ara mateix";
  if (m < 60) return `fa ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `fa ${h}h`;
  const d = Math.floor(h / 24);
  return `fa ${d}d`;
}

function formatK(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}k`;
}
