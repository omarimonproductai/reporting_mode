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
  disabled?: boolean;
  ariaInvalid?: boolean;
};

export function ReportCombobox({
  value,
  onChange,
  disabled,
  ariaInvalid,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { state, refresh } = useSpaceCatalog();

  const reports = state.kind === "ready" ? state.catalog.reports : [];
  const matched = reports.find((r) => r.token === value);
  const hasValue = value.trim() !== "";
  // Token is set but not in the current catalog (renamed / deleted at Mode,
  // catalog still loading, or API down). Surface a soft warning.
  const showStaleWarning =
    state.kind === "ready" && hasValue && !matched;

  function selectReport(token: string) {
    onChange(token);
    setQuery("");
    setOpen(false);
  }

  function commitTyped() {
    const trimmed = query.trim();
    if (!trimmed) return;
    selectReport(trimmed);
  }

  const trimmedQuery = query.trim();
  const lowerQuery = trimmedQuery.toLowerCase();
  const filtered = trimmedQuery
    ? reports.filter(
        (r) =>
          r.name.toLowerCase().includes(lowerQuery) ||
          r.token.toLowerCase().includes(lowerQuery)
      )
    : reports;
  const exactMatch = reports.some((r) => r.token === trimmedQuery);
  const showUseTyped = trimmedQuery.length > 0 && !exactMatch;

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
              {matched ? (
                <>
                  <span className="font-medium text-zinc-900">
                    {matched.name}
                  </span>
                  <span className="ml-2 font-mono text-xs text-zinc-400">
                    {matched.token}
                  </span>
                </>
              ) : hasValue ? (
                <span className="font-mono text-zinc-900">{value}</span>
              ) : (
                <span className="text-zinc-400">Select report…</span>
              )}
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
                  Carregant reports…
                </div>
              )}
              {state.kind === "error" && (
                <div className="px-3 py-4 text-xs text-red-600">
                  Error: {state.message}
                </div>
              )}
              {state.kind === "ready" && reports.length === 0 && (
                <CommandEmpty>
                  <div className="px-3 py-3 text-xs text-zinc-500">
                    Cap report al space Mode. Comprova el MODE_SPACE
                    configurat.
                  </div>
                </CommandEmpty>
              )}
              {state.kind === "ready" && filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((r) => (
                    <CommandItem
                      key={r.token}
                      value={r.token}
                      onSelect={() => selectReport(r.token)}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {r.name}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {r.token}
                        </span>
                      </div>
                      {value === r.token && (
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
                    onSelect={() => selectReport(trimmedQuery)}
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
            Aquest token no apareix al catàleg actual del space. El brief
            funcionarà igualment si encara existeix a Mode.
          </span>
        </div>
      )}
    </div>
  );
}
