"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PreviewTable } from "@/components/PreviewTable";
import { SheetResizeHandle } from "@/components/SheetResizeHandle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useResizableSheetWidth } from "@/hooks/useResizableSheetWidth";
import { formatCatalunyaDateTime, relativeFromPast } from "@/lib/cron";
import { useSpaceCatalog } from "@/lib/spaceCatalogClient";
import type { PreviewResult } from "@/lib/preview-types";

type Props = {
  open: boolean;
  reportToken: string | null;
  queryToken: string | null;
  onClose: () => void;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: PreviewResult }
  | { kind: "error"; message: string };

export function PreviewSheet({
  open,
  reportToken,
  queryToken,
  onClose,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [refreshCounter, setRefreshCounter] = useState(0);
  const { width, handleProps } = useResizableSheetWidth();

  useEffect(() => {
    if (!open || !reportToken || !queryToken) {
      return;
    }
    const controller = new AbortController();

    const params = new URLSearchParams({ limit: "10" });
    if (refreshCounter > 0) {
      params.set("force", "true");
    }
    const url = `/api/mode/preview/${reportToken}/${queryToken}?${params.toString()}`;

    (async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          let body: { message?: string } | null = null;
          try {
            body = (await res.json()) as { message?: string };
          } catch {
            // ignore — fall back to a generic message
          }
          throw new Error(
            body?.message ?? `Preview fetch failed: ${res.status}`
          );
        }
        const data = (await res.json()) as PreviewResult;
        setState({ kind: "ready", data });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Stale request superseded by a newer one — silent bail.
          return;
        }
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setState({ kind: "error", message });
      }
    })();

    return () => controller.abort();
  }, [open, reportToken, queryToken, refreshCounter]);

  function refresh() {
    setRefreshCounter((n) => n + 1);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col p-0 sm:max-w-none"
        style={{ width: `${width}px` }}
      >
        <SheetResizeHandle {...handleProps} />
        <SheetHeader className="shrink-0 pr-12">
          <SheetTitle>
            <PreviewHeader
              reportToken={reportToken}
              queryToken={queryToken}
              state={state}
              onRefresh={refresh}
            />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Vista prèvia de l&apos;última execució de la query a Mode.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <PreviewBody state={state} onRetry={refresh} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewHeader({
  reportToken,
  queryToken,
  state,
  onRefresh,
}: {
  reportToken: string | null;
  queryToken: string | null;
  state: State;
  onRefresh: () => void;
}) {
  const catalog = useSpaceCatalog();
  let queryName: string | null = null;
  if (catalog.state.kind === "ready" && reportToken && queryToken) {
    const report = catalog.state.catalog.reports.find(
      (r) => r.token === reportToken
    );
    const q = report?.queries.find((q) => q.token === queryToken);
    queryName = q?.name ?? null;
  }
  // When the preview endpoint resolved the query (ready state), prefer
  // the name it returned — it's the source of truth at this point and
  // covers tokens that aren't in the cached catalog.
  if (state.kind === "ready" && state.data.kind === "ready") {
    queryName = state.data.query.name;
  }

  const ready = state.kind === "ready" && state.data.kind === "ready";
  const completedAt = ready
    ? state.kind === "ready" && state.data.kind === "ready"
      ? state.data.run.completed_at
      : null
    : null;
  const totalRows =
    state.kind === "ready" && state.data.kind === "ready"
      ? state.data.total_rows
      : null;
  const columnCount =
    state.kind === "ready" && state.data.kind === "ready"
      ? state.data.columns.length
      : null;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 text-left">
        <div className="text-base font-medium text-zinc-900">
          {queryName ?? queryToken ?? "Preview"}
        </div>
        {queryName && queryToken && (
          <div className="font-mono text-xs text-zinc-500">{queryToken}</div>
        )}
        {completedAt && (
          <div className="mt-1 font-mono text-[11px] text-zinc-500">
            Last Mode run · {relativeFromPast(new Date(completedAt))} ·{" "}
            {formatCatalunyaDateTime(new Date(completedAt))}
          </div>
        )}
        {totalRows !== null && columnCount !== null && (
          <div className="text-[11px] text-zinc-500">
            {totalRows} rows · {columnCount} columns
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={state.kind === "loading"}
        aria-label="Refresh preview"
      >
        <RefreshCw />
      </Button>
    </div>
  );
}

function PreviewBody({
  state,
  onRetry,
}: {
  state: State;
  onRetry: () => void;
}) {
  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <p className="pt-2 text-xs text-zinc-500">Carregant preview…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertTriangle />
        <AlertTitle>Mode no disponible</AlertTitle>
        <AlertDescription>
          {state.message} — torna a provar més tard.
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRetry}
            >
              <RefreshCw />
              Retry
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const { data } = state;
  switch (data.kind) {
    case "no-previous-run":
      return (
        <p className="pt-4 text-sm text-zinc-600">
          Cap run previ d&apos;aquest report a Mode. Desa el brief i fes
          Run Now per disparar el primer fetch.
        </p>
      );
    case "run-failed":
      return (
        <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle />
          <AlertTitle>L&apos;últim run d&apos;aquest report ha fallat</AlertTitle>
          <AlertDescription>
            State: <span className="font-mono">{data.run.state}</span>. Tria
            un altre report o investiga directament a Mode.
          </AlertDescription>
        </Alert>
      );
    case "query-not-found":
      return (
        <p className="pt-4 text-sm text-zinc-600">
          Aquesta query no apareix dins de l&apos;últim run del report. Pot
          ser que s&apos;hagi renombrat o esborrat a Mode.
        </p>
      );
    case "ready":
      return (
        <div className="pt-4">
          <PreviewTable
            columns={data.columns}
            rows={data.rows}
            total_rows={data.total_rows}
          />
        </div>
      );
  }
}
