"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DryRunSheet } from "@/components/DryRunSheet";
import type { Brief } from "@/lib/schemas";

type Ctx = {
  run: (brief: Brief) => void;
};

const DryRunContext = createContext<Ctx | null>(null);

export function DryRunProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<Brief | null>(null);

  return (
    <DryRunContext.Provider value={{ run: (brief) => setPayload(brief) }}>
      {children}
      <DryRunSheet
        open={payload !== null}
        payload={payload}
        onClose={() => setPayload(null)}
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
