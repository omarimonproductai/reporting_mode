"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DryRunSheet } from "@/components/DryRunSheet";
import type { Brief } from "@/lib/schemas";

type RunOpts = { filename?: string };

type Ctx = {
  run: (brief: Brief, opts?: RunOpts) => void;
};

const DryRunContext = createContext<Ctx | null>(null);

export function DryRunProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    { payload: Brief; filename: string | null } | null
  >(null);

  return (
    <DryRunContext.Provider
      value={{
        run: (brief, opts) =>
          setState({ payload: brief, filename: opts?.filename ?? null }),
      }}
    >
      {children}
      <DryRunSheet
        open={state !== null}
        payload={state?.payload ?? null}
        filename={state?.filename ?? null}
        onClose={() => setState(null)}
      />
    </DryRunContext.Provider>
  );
}

export function useDryRun(): Ctx {
  const ctx = useContext(DryRunContext);
  if (!ctx) {
    throw new Error(
      "useDryRun called outside DryRunProvider — mount the provider in app/layout.tsx"
    );
  }
  return ctx;
}
