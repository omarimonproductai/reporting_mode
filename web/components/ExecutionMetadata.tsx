"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RunRecord } from "@/lib/runs";
import { outputTokenColorClass } from "@/lib/tokenWarnings";

type State =
  | { kind: "loading" }
  | {
      kind: "ready";
      record: RunRecord;
      artifact_name: string;
      artifact_created_at: string;
    }
  | { kind: "never-run" }
  | { kind: "error"; message: string };

type ApiResponse =
  | {
      kind: "ready";
      record: RunRecord;
      artifact_name: string;
      artifact_created_at: string;
    }
  | { kind: "never-run" }
  | { error: string };

export function ExecutionMetadata({ filename }: { filename: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const router = useRouter();

  const load = useCallback(
    async (force: boolean) => {
      setState({ kind: "loading" });
      try {
        const url = force
          ? `/api/runs/${filename}?force=true`
          : `/api/runs/${filename}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as ApiResponse;
        if ("error" in data) {
          throw new Error(data.error);
        }
        if (data.kind === "ready") {
          setState({
            kind: "ready",
            record: data.record,
            artifact_name: data.artifact_name,
            artifact_created_at: data.artifact_created_at,
          });
        } else {
          setState({ kind: "never-run" });
        }
        // The sidebar lives in the static root layout and won't re-render on
        // its own. After every successful load (initial mount or manual
        // refresh) trigger a server re-render so the sidebar's status dot,
        // relative time and token badge pick up the same data we just showed
        // in the ExecutionMetadata card.
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ kind: "error", message });
      }
    },
    [filename, router]
  );

  useEffect(() => {
    // Force on initial mount. The /api/runs/[brief] endpoint has a
    // 5-min cache that would otherwise serve a stale entry from
    // before the user's most recent Run Now / scheduled run. The
    // sidebar already fetches fresh via fetchLatestRuns (no API
    // cache) so anything less than force=true here causes a
    // visible discrepancy: sidebar shows the latest run but this
    // card shows an older one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
  }, [load]);

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="ml-auto size-7 rounded-md" />
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-700">
            No s&apos;ha pogut carregar la informació d&apos;execució.
            <div className="mt-0.5 text-xs text-zinc-500">{state.message}</div>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => void load(true)}
          >
            <RefreshCw />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (state.kind === "never-run") {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-500">Mai executat</div>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={() => void load(true)}
            aria-label="Refresh"
          >
            <RefreshCw />
          </Button>
        </div>
      </Card>
    );
  }

  const { record } = state;
  const ok = record.status === "success";
  const stamp = record.finished_at ?? record.started_at;
  const t = record.tokens;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {ok ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="size-4 shrink-0 text-red-500" />
          )}
          <span className="font-medium text-zinc-900">
            Last run: {ok ? "success" : "failed"}
          </span>
          <span className="text-zinc-300">·</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-xs text-zinc-500">
                {formatMadrid(stamp)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{stamp}</TooltipContent>
          </Tooltip>
          {t && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="font-mono text-xs text-zinc-500">
                {t.input.toLocaleString("ca-ES")} in
                <span className="text-zinc-400"> + </span>
                <span className={outputTokenColorClass(t.output)}>
                  {t.output.toLocaleString("ca-ES")} out
                </span>
                <span className="text-zinc-400">
                  {" "}
                  ({t.total.toLocaleString("ca-ES")} total)
                </span>
              </span>
            </>
          )}
        </div>

        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={() => void load(true)}
          aria-label="Refresh"
        >
          <RefreshCw />
        </Button>
      </div>

      {!ok && record.error && (
        <div className="mt-2 rounded border border-red-100 bg-red-50/60 px-2 py-1 text-xs text-red-700">
          {record.error}
        </div>
      )}

      <div className="mt-1 truncate pl-6 text-[10px] font-mono text-zinc-400">
        from {state.artifact_name}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5">
      {children}
    </div>
  );
}

function formatMadrid(iso: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("ca-ES", {
      timeZone: "Europe/Madrid",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
    );
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute} Catalunya`;
  } catch {
    return iso;
  }
}
