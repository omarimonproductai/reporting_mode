"use client";

import { useState } from "react";
import { AlertCircle, Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSpaceCatalog } from "@/lib/spaceCatalogClient";

type Props = {
  value: string;
  onChange: (token: string) => void;
  reportToken: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
};

export function QueryCombobox({
  value,
  onChange,
  reportToken,
  disabled,
  ariaInvalid,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { state, refresh } = useSpaceCatalog();

  const parentReport =
    state.kind === "ready"
      ? state.catalog.reports.find((r) => r.token === reportToken)
      : undefined;
  const queries = parentReport?.queries ?? [];
  const matched = queries.find((q) => q.token === value);
  const hasValue = value.trim() !== "";
  const hasReport = reportToken.trim() !== "";

  // Token saved but not in the current parent report's query list. Could be a
  // rename / removal at Mode, or the parent report token was just edited to a
  // different one. Show a soft warning.
  const showStaleWarning =
    state.kind === "ready" &&
    hasValue &&
    hasReport &&
    parentReport !== undefined &&
    !matched;

  function selectQuery(token: string) {
    onChange(token);
    setQuery("");
    setOpen(false);
  }

  function commitTyped() {
    const trimmed = query.trim();
    if (!trimmed) return;
    selectQuery(trimmed);
  }

  const trimmedQuery = query.trim();
  const lowerQuery = trimmedQuery.toLowerCase();
  const filtered = trimmedQuery
    ? queries.filter(
        (q) =>
          q.name.toLowerCase().includes(lowerQuery) ||
          q.token.toLowerCase().includes(lowerQuery)
      )
    : queries;
  const exactMatch = queries.some((q) => q.token === trimmedQuery);
  const showUseTyped = trimmedQuery.length > 0 && !exactMatch;

  // Placeholder copy adapts to context: no report selected yet, parent token
  // not in catalog, empty report, etc.
  let triggerLabel: React.ReactNode;
  if (matched) {
    triggerLabel = (
      <>
        <span className="font-medium text-zinc-900">{matched.name}</span>
        <span className="ml-2 font-mono text-xs text-zinc-400">
          {matched.token}
        </span>
      </>
    );
  } else if (hasValue) {
    triggerLabel = <span className="font-mono text-zinc-900">{value}</span>;
  } else if (!hasReport) {
    triggerLabel = (
      <span className="text-zinc-400">Selecciona report primer…</span>
    );
  } else {
    triggerLabel = <span className="text-zinc-400">Select query…</span>;
  }

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm transition-colors",
              "hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400",
              "disabled:cursor-not-allowed disabled:opacity-60",
              ariaInvalid && "border-red-300 ring-2 ring-red-100"
            )}
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {triggerLabel}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-zinc-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or token…"
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Enter" && showUseTyped) {
                  e.preventDefault();
                  commitTyped();
                }
              }}
            />
            <CommandList>
              {state.kind === "loading" && (
                <div className="px-3 py-4 text-xs text-zinc-500">
                  Carregant queries…
                </div>
              )}
              {state.kind === "error" && (
                <div className="px-3 py-4 text-xs text-red-600">
                  Error: {state.message}
                </div>
              )}
              {state.kind === "ready" && !hasReport && (
                <CommandEmpty>
                  <div className="px-3 py-3 text-xs text-zinc-500">
                    Selecciona un Mode report al source per veure les
                    seves queries.
                  </div>
                </CommandEmpty>
              )}
              {state.kind === "ready" &&
                hasReport &&
                !parentReport && (
                  <CommandEmpty>
                    <div className="px-3 py-3 text-xs text-zinc-500">
                      El report del source no és al catàleg actual. Pots
                      escriure el token manualment.
                    </div>
                  </CommandEmpty>
                )}
              {state.kind === "ready" &&
                parentReport &&
                queries.length === 0 && (
                  <CommandEmpty>
                    <div className="px-3 py-3 text-xs text-zinc-500">
                      Aquest report no té queries.
                    </div>
                  </CommandEmpty>
                )}
              {state.kind === "ready" && filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((q) => (
                    <CommandItem
                      key={q.token}
                      value={q.token}
                      onSelect={() => selectQuery(q.token)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {q.name}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {q.token}
                        </span>
                      </div>
                      {value === q.token && (
                        <Check className="ml-2 size-3.5 shrink-0 text-zinc-500" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showUseTyped && (
                <CommandGroup>
                  <CommandItem
                    value={`__use__${trimmedQuery}`}
                    onSelect={() => selectQuery(trimmedQuery)}
                  >
                    <span className="text-sm text-zinc-700">
                      Use token «
                      <span className="font-mono">{trimmedQuery}</span>»
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <div className="flex items-center justify-end border-t border-zinc-100 px-2 py-1.5">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => refresh()}
            >
              <RefreshCw />
              Refresh catalog
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {showStaleWarning && (
        <div className="flex items-start gap-1.5 text-[11px] text-amber-700">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          <span>
            Aquesta query no apareix dins del report del catàleg actual.
            Funcionarà si encara existeix a Mode.
          </span>
        </div>
      )}
    </div>
  );
}
