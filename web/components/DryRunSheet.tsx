"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Square,
} from "lucide-react";
import { BriefMarkdown } from "@/components/BriefMarkdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Brief } from "@/lib/schemas";
import { setLastDryRun } from "@/lib/dryRunTracking";

type Props = {
  open: boolean;
  payload: Brief | null;
  // Filename of the persisted brief this dry-run is for. Null on
  // create-flow dry-runs (the brief has no filename yet). When
  // present and the dry-run reaches `ready`, the Sheet records a
  // localStorage timestamp via setLastDryRun(filename) so the
  // RunNowButton can skip its «no preview recent» confirmation.
  filename: string | null;
  onClose: () => void;
};

type TokenUsage = { input: number; output: number; total: number };

type State =
  | { kind: "idle" }
  | { kind: "loading-mode" }
  | { kind: "streaming-groq"; markdown: string }
  | {
      kind: "ready";
      markdown: string;
      usage: TokenUsage;
    }
  | { kind: "cancelled"; markdown: string }
  | {
      kind: "error";
      markdown: string;
      phase: "mode" | "groq";
      message: string;
    };

export function DryRunSheet({ open, payload, filename, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (!open || !payload) {
      return;
    }
    const controller = new AbortController();

    (async () => {
      setState({ kind: "loading-mode" });
      let accumulated = "";

      try {
        const res = await fetch("/api/briefs/dry-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          let detail = res.statusText;
          try {
            const body = (await res.json()) as { error?: string };
            if (body.error) detail = body.error;
          } catch {
            // ignore — fall back to status text
          }
          setState({
            kind: "error",
            markdown: "",
            phase: "mode",
            message: detail,
          });
          return;
        }
        if (!res.body) {
          setState({
            kind: "error",
            markdown: "",
            phase: "mode",
            message: "Resposta sense cos d'streaming.",
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE messages are separated by a double newline.
          let separatorIdx;
          while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
            const rawMessage = buffer.slice(0, separatorIdx);
            buffer = buffer.slice(separatorIdx + 2);
            const dataLine = rawMessage
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            const json = dataLine.slice(6);
            let event: {
              kind: string;
              delta?: string;
              usage?: TokenUsage;
              phase?: "mode" | "groq";
              message?: string;
            };
            try {
              event = JSON.parse(json);
            } catch {
              continue;
            }
            if (event.kind === "mode-fetched") {
              setState({ kind: "streaming-groq", markdown: "" });
            } else if (event.kind === "groq-chunk" && event.delta) {
              accumulated += event.delta;
              setState({
                kind: "streaming-groq",
                markdown: accumulated,
              });
            } else if (event.kind === "complete" && event.usage) {
              setState({
                kind: "ready",
                markdown: accumulated,
                usage: event.usage,
              });
              if (filename) setLastDryRun(filename);
            } else if (event.kind === "error" && event.message) {
              setState({
                kind: "error",
                markdown: accumulated,
                phase: event.phase ?? "groq",
                message: event.message,
              });
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Caller-initiated cancel — preserve the accumulated
          // markdown so the user can still read what was generated.
          setState({ kind: "cancelled", markdown: accumulated });
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setState({
          kind: "error",
          markdown: accumulated,
          phase: "groq",
          message,
        });
      }
    })();

    return () => controller.abort();
  }, [open, payload]);

  function cancel() {
    // Abort path: closing the sheet has the same effect via the
    // useEffect cleanup. Calling onClose here keeps the cancel
    // button's UX explicit instead of relying on the user clicking
    // the X.
    onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="shrink-0 pr-12">
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-base font-medium">
              <Sparkles className="size-4 text-zinc-500" />
              Preview output
            </span>
            {(state.kind === "loading-mode" ||
              state.kind === "streaming-groq") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancel}
              >
                <Square />
                Cancel
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            <PhaseIndicator state={state} />
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <DryRunBody state={state} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PhaseIndicator({ state }: { state: State }) {
  switch (state.kind) {
    case "idle":
      return <span className="text-xs text-zinc-500">Esperant…</span>;
    case "loading-mode":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 className="size-3 animate-spin" />
          Carregant Mode data…
        </span>
      );
    case "streaming-groq":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <Loader2 className="size-3 animate-spin" />
          Generant amb GROQ…
        </span>
      );
    case "ready":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="size-3" />
          Llest · Input {state.usage.input} · Output {state.usage.output} ·
          Total {state.usage.total} tokens
        </span>
      );
    case "cancelled":
      return (
        <span className="text-xs text-zinc-500">
          Cancel·lat. L&apos;output parcial es manté sota.
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-red-700">
          <AlertTriangle className="size-3" />
          Error a {state.phase === "mode" ? "Mode" : "GROQ"}
        </span>
      );
  }
}

function DryRunBody({ state }: { state: State }) {
  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-3 pt-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{state.phase === "mode" ? "Mode" : "GROQ"} ha fallat</AlertTitle>
          <AlertDescription>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-red-50/50 p-2 font-mono text-[11px] leading-snug text-red-900">
              {state.message}
            </pre>
          </AlertDescription>
        </Alert>
        {state.markdown && (
          <div className="rounded border border-zinc-200 p-3">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-400">
              Output parcial abans de l&apos;error
            </p>
            <BriefMarkdown>{state.markdown}</BriefMarkdown>
          </div>
        )}
      </div>
    );
  }

  if (state.kind === "loading-mode") {
    return (
      <p className="pt-6 text-sm text-zinc-600">
        Recollint les dades de Mode. Pot trigar 5-15 segons.
      </p>
    );
  }

  return (
    <div className="pt-4">
      <BriefMarkdown>{state.markdown}</BriefMarkdown>
      {state.kind === "cancelled" && (
        <p className="mt-3 text-[11px] uppercase tracking-wide text-zinc-400">
          (Cancel·lat)
        </p>
      )}
    </div>
  );
}
