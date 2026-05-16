"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RunRecord } from "@/lib/runs";

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
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ kind: "error", message });
      }
    },
    [filename]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, [load]);

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="text-xs text-zinc-400">Carregant execució…</div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-700">
            No s&apos;ha pogut carregar la informació d&apos;execució.
            <div className="mt-1 text-xs text-zinc-500">{state.message}</div>
          </div>
          <Button
            type="button"
            size="sm"
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
            size="sm"
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

  const { record, artifact_created_at } = state;
  const ok = record.status === "success";
  const stamp = record.finished_at ?? record.started_at;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {ok ? (
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 size-5 text-red-500" />
          )}
          <div>
            <div className="text-sm font-medium text-zinc-900">
              Last run: {ok ? "success" : "failed"}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-xs text-zinc-500">
                  {formatMadrid(stamp)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">{stamp}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void load(true)}
          aria-label="Refresh"
        >
          <RefreshCw />
        </Button>
      </div>

      {record.tokens && (
        <div className="mt-3 flex gap-6 border-t border-zinc-100 pt-3 text-xs">
          <TokenStat label="Input tokens" value={record.tokens.input} />
          <TokenStat label="Output tokens" value={record.tokens.output} />
          <TokenStat label="Total" value={record.tokens.total} muted />
        </div>
      )}

      {!ok && record.error && (
        <div className="mt-3 rounded-md border border-red-100 bg-red-50/60 px-3 py-2 text-xs text-red-700">
          {record.error}
        </div>
      )}

      <div className="mt-3 text-[11px] text-zinc-400 font-mono">
        from {artifact_created_at.slice(0, 19)}Z · {state.artifact_name}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      {children}
    </div>
  );
}

function TokenStat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div
        className={cn(
          "font-mono",
          muted ? "text-zinc-500" : "text-zinc-900 text-sm"
        )}
      >
        {value.toLocaleString("ca-ES")}
      </div>
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
