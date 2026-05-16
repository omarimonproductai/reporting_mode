"use client";

import { useEffect, useState } from "react";
import type { SpaceCatalog } from "@/lib/mode-types";

export type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; catalog: SpaceCatalog }
  | { kind: "error"; message: string };

const TTL_MS = 5 * 60 * 1000;

let cached: CatalogState = { kind: "loading" };
let cachedAt = 0;
let inFlight: Promise<void> | null = null;

// Tiny pub-sub so every combobox mounted on the page shares one fetch
// of the catalog instead of each requesting it independently.
const listeners = new Set<(s: CatalogState) => void>();

function notify(next: CatalogState) {
  cached = next;
  for (const l of listeners) l(next);
}

async function load(force = false): Promise<void> {
  if (!force && cached.kind === "ready" && Date.now() - cachedAt < TTL_MS) {
    return;
  }
  if (inFlight) return inFlight;
  notify({ kind: "loading" });
  inFlight = (async () => {
    try {
      const url = force
        ? "/api/mode/space-catalog?force=true"
        : "/api/mode/space-catalog";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SpaceCatalog;
      cachedAt = Date.now();
      notify({ kind: "ready", catalog: data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      notify({ kind: "error", message });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function useSpaceCatalog() {
  const [state, setState] = useState<CatalogState>(cached);

  useEffect(() => {
    listeners.add(setState);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(cached);
    void load();
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { state, refresh: () => void load(true) };
}
