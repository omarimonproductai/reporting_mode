"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BriefListItemWithRun } from "@/lib/briefs";
import type { RunLookup } from "@/lib/runs";

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
  const nameRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const check = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    };
    // 1) Initial measurement after the browser has laid out.
    const raf = requestAnimationFrame(check);
    // 2) Re-measure once Inter (next/font) has finished swapping in —
    //    the box size doesn't change so ResizeObserver wouldn't fire,
    //    but the rendered text width does.
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => {
        if (nameRef.current) check();
      });
    }
    // 3) Subsequent box-size changes (sidebar / viewport resize).
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [brief.name]);

  const row = (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm text-zinc-700 transition-colors",
        isActive
          ? "bg-zinc-100 font-medium text-zinc-900"
          : "hover:bg-zinc-100"
      )}
    >
      <div className="flex items-center gap-1.5">
        <StatusIcon run={brief.run} />
        <span ref={nameRef} className="min-w-0 flex-1 truncate">
          {brief.name}
        </span>
      </div>
      <RunMeta run={brief.run} />
    </Link>
  );

  return (
    <li>
      {isTruncated ? (
        <Tooltip>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent side="right">{brief.name}</TooltipContent>
        </Tooltip>
      ) : (
        row
      )}
    </li>
  );
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
          {formatK(tokens.input)} + {formatK(tokens.output)}
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
