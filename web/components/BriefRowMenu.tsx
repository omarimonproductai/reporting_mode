"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Edit,
  History,
  Loader2,
  MoreVertical,
  Play,
  Sparkles,
} from "lucide-react";
import { DraftRunConfirmDialog } from "@/components/DraftRunConfirmDialog";
import { PublishToggleButton } from "@/components/PublishToggleButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMmSs, useRunNow } from "@/hooks/useRunNow";
import { useDryRun } from "@/hooks/useDryRun";
import { briefSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Props = {
  filename: string;
  published?: boolean;
  briefName?: string;
};

export function BriefRowMenu({
  filename,
  published = true,
  briefName,
}: Props) {
  const { running, onCooldown, remainingSeconds, dispatch } =
    useRunNow(filename);
  const { run } = useDryRun();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const runDisabled = running || onCooldown;
  const runLabel = running
    ? "Running…"
    : onCooldown
      ? `Run Now (${formatMmSs(remainingSeconds)})`
      : "Run Now";

  function onRunClick() {
    if (!published) {
      setConfirmOpen(true);
      return;
    }
    void dispatch();
  }

  function onConfirm() {
    setConfirmOpen(false);
    void dispatch();
  }

  async function onPreviewOutput() {
    if (previewLoading) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/briefs/${filename}`);
      if (!res.ok) throw new Error(`Failed to load brief: ${res.status}`);
      const body = (await res.json()) as { brief: unknown };
      const parsed = briefSchema.safeParse(body.brief);
      if (!parsed.success) {
        throw new Error("Brief failed schema validation");
      }
      run(parsed.data);
    } catch {
      // Silently fail — the user can retry. The detail-page Preview
      // output button is the more reliable path; the kebab item is a
      // shortcut.
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Brief actions"
            // `opacity-0 group-hover:opacity-100` makes the kebab quiet by
            // default; `focus-visible:` keeps it reachable by keyboard;
            // `data-[state=open]:` pins it visible while the popover is open
            // so it doesn't blink away when the cursor leaves the row.
            //
            // No click-handler interception here: `preventDefault()` on a
            // Radix `asChild` trigger cancels Radix's own open handler, so
            // the popover never appears. The kebab is a DOM sibling of the
            // sidebar row's <Link>, not a descendant — clicks don't bubble
            // to the link by themselves, so `stopPropagation()` isn't
            // needed either.
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-200 hover:text-zinc-900 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-48 p-1">
          <MenuLink
            href={`/briefs/${filename}?edit=1`}
            icon={<Edit className="size-4 text-zinc-500" />}
            label="Edit"
          />
          <button
            type="button"
            disabled={runDisabled}
            onClick={onRunClick}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
              "text-zinc-700 hover:bg-zinc-100",
              "disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent"
            )}
          >
            <Play className="size-4 text-zinc-500" />
            {runLabel}
          </button>
          <MenuLink
            href={`/briefs/${filename}?history=1`}
            icon={<History className="size-4 text-zinc-500" />}
            label="History"
          />
          <button
            type="button"
            disabled={previewLoading}
            onClick={onPreviewOutput}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
              "text-zinc-700 hover:bg-zinc-100",
              "disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent"
            )}
          >
            {previewLoading ? (
              <Loader2 className="size-4 animate-spin text-zinc-500" />
            ) : (
              <Sparkles className="size-4 text-zinc-500" />
            )}
            Preview output
          </button>
          <PublishToggleButton
            filename={filename}
            published={published}
            variant="menu-item"
          />
        </PopoverContent>
      </Popover>
      <DraftRunConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onConfirm}
        briefName={briefName}
      />
    </>
  );
}

function MenuLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100"
    >
      {icon}
      {label}
    </Link>
  );
}
