"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  History as HistoryIcon,
  RefreshCw,
} from "lucide-react";
import { BriefMarkdown } from "@/components/BriefMarkdown";
import { SheetResizeHandle } from "@/components/SheetResizeHandle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useResizableSheetWidth } from "@/hooks/useResizableSheetWidth";
import { formatCatalunyaDateTime, relativeFromPast } from "@/lib/cron";
import type { BriefOutput } from "@/lib/outputs";
import { cn } from "@/lib/utils";

type Props = {
  filename: string;
  briefName: string;
  slackChannel: string;
  // When true (driven by `?history=1` on the brief detail page), the
  // drawer opens automatically on mount. Used by the sidebar kebab's
  // History action so a single click both navigates and opens the
  // drawer without the user having to click History again.
  initialOpen?: boolean;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; outputs: BriefOutput[] }
  | { kind: "error"; message: string };

export function HistoryDrawerButton({
  filename,
  briefName,
  slackChannel,
  initialOpen = false,
}: Props) {
  const [open, setOpen] = useState(initialOpen);
  const [state, setState] = useState<State>({ kind: "idle" });
  const { width, handleProps } = useResizableSheetWidth();

  const load = useCallback(
    async (force: boolean) => {
      setState({ kind: "loading" });
      try {
        const url = force
          ? `/api/briefs/${filename}/outputs?force=true`
          : `/api/briefs/${filename}/outputs`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { outputs: BriefOutput[] };
        setState({ kind: "ready", outputs: data.outputs });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({ kind: "error", message });
      }
    },
    [filename]
  );

  // When the page lands with `?history=1` the drawer is open on the first
  // render but the data fetch happens here so server-side rendering stays
  // free of any client-only side effect.
  useEffect(() => {
    if (initialOpen) {
      void load(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && state.kind === "idle") {
      void load(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <HistoryIcon />
          History
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="overflow-y-auto sm:max-w-none"
        style={{ width: `${width}px` }}
      >
        <SheetResizeHandle {...handleProps} />
        <SheetHeader>
          <SheetTitle>{briefName}</SheetTitle>
          <SheetDescription>
            Últims outputs capturats d&apos;aquest brief (fins a 3).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4 pb-6">
          {state.kind === "loading" && <DrawerSkeleton />}
          {state.kind === "error" && (
            <DrawerError message={state.message} onRetry={() => load(true)} />
          )}
          {state.kind === "ready" && state.outputs.length === 0 && (
            <p className="text-sm text-zinc-500">
              Cap output capturat encara. El proper run amb GROQ amb èxit
              farà aparèixer-ne un aquí.
            </p>
          )}
          {state.kind === "ready" && state.outputs.length > 0 && (
            <div className="flex flex-col gap-5">
              {state.outputs.map((output, idx) => (
                <DrawerEntry
                  key={output.artifact_name}
                  output={output}
                  slackChannel={slackChannel}
                  isLatest={idx === 0}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerEntry({
  output,
  slackChannel,
  isLatest,
}: {
  output: BriefOutput;
  slackChannel: string;
  isLatest: boolean;
}) {
  const date = new Date(output.created_at);
  const ok = output.run_status === "success";
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4",
        !isLatest && "bg-zinc-50/50"
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span
          className={cn(
            "font-medium",
            ok ? "text-emerald-700" : "text-red-700"
          )}
        >
          {ok ? "Èxit" : "Error"}
        </span>
        <span className="text-zinc-400">·</span>
        <span className="font-mono text-zinc-500">
          {relativeFromPast(date)} · {formatCatalunyaDateTime(date)}
        </span>
        <span className="text-zinc-400">·</span>
        <span className="font-mono text-zinc-500">#{slackChannel}</span>
      </div>
      <BriefMarkdown>{output.markdown}</BriefMarkdown>
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4">
          <Skeleton className="mb-3 h-3 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function DrawerError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-center">
      <AlertTriangle className="mx-auto size-6 text-amber-500" />
      <p className="mt-2 text-sm text-zinc-900">
        No s&apos;ha pogut carregar l&apos;historial.
      </p>
      <p className="mt-1 text-xs text-zinc-500">{message}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={onRetry}
      >
        <RefreshCw />
        Retry
      </Button>
    </div>
  );
}
