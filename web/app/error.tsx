"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GenericError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50/40 px-6 py-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-red-500" />
        <h2 className="mt-3 text-sm font-medium text-zinc-900">
          Alguna cosa ha fallat
        </h2>
        <p className="mt-1 text-xs text-zinc-600">
          {error.message || "Error desconegut"}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-zinc-400">
            digest: {error.digest}
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-5"
          onClick={() => reset()}
        >
          <RotateCw />
          Torna a provar
        </Button>
      </div>
    </div>
  );
}
