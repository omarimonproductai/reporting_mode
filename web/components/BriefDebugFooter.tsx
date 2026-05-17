"use client";

import { useEffect, useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loaded"; artifact_name: string }
  | { kind: "absent" };

export function BriefDebugFooter({ filename }: { filename: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/runs/${filename}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { kind: string; artifact_name?: string }) => {
        if (cancelled) return;
        if (data.kind === "ready" && data.artifact_name) {
          setState({ kind: "loaded", artifact_name: data.artifact_name });
        } else {
          setState({ kind: "absent" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "absent" });
      });
    return () => {
      cancelled = true;
    };
  }, [filename]);

  if (state.kind !== "loaded") return null;

  return (
    <div className="mt-10 border-t border-zinc-100 pt-4 text-[10px] font-mono text-zinc-400">
      <div className="mb-1 uppercase tracking-wider text-zinc-300">
        Debug info
      </div>
      <div className="truncate">from {state.artifact_name}</div>
    </div>
  );
}
