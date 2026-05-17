"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit, History, MoreVertical, Play } from "lucide-react";
import { DraftRunConfirmDialog } from "@/components/DraftRunConfirmDialog";
import { PublishToggleButton } from "@/components/PublishToggleButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMmSs, useRunNow } from "@/hooks/useRunNow";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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
