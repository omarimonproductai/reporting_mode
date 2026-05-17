"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftRunConfirmDialog } from "@/components/DraftRunConfirmDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMmSs, useRunNow } from "@/hooks/useRunNow";

type Props =
  | { mode: "create" }
  | {
      mode: "existing";
      filename: string;
      // Persisted publish state. Drafts get a confirmation dialog before
      // dispatch; the default `true` keeps existing call-sites (that
      // haven't been updated to pass the prop) safe.
      published?: boolean;
      briefName?: string;
    };

export function RunNowButton(props: Props) {
  if (props.mode === "create") {
    // Disabled-with-hint on /briefs/new. Wrapping the disabled button
    // in a span keeps the Tooltip listener alive — Radix tooltips don't
    // receive hover events on a child whose pointer-events: none.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button type="button" size="sm" disabled>
              <Play />
              Run Now
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Crea el brief abans de poder executar-lo.
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <RunNowButtonExisting
      filename={props.filename}
      published={props.published ?? true}
      briefName={props.briefName}
    />
  );
}

function RunNowButtonExisting({
  filename,
  published,
  briefName,
}: {
  filename: string;
  published: boolean;
  briefName?: string;
}) {
  const { running, onCooldown, remainingSeconds, dispatch } =
    useRunNow(filename);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const disabled = running || onCooldown;
  const label = running
    ? "Running…"
    : onCooldown
      ? `Run Now — torna a provar en ${formatMmSs(remainingSeconds)}`
      : "Run Now";

  function onClick() {
    if (!published) {
      setConfirmOpen(true);
      return;
    }
    dispatch();
  }

  function onConfirm() {
    setConfirmOpen(false);
    dispatch();
  }

  return (
    <>
      <Button type="button" size="sm" disabled={disabled} onClick={onClick}>
        <Play />
        {label}
      </Button>
      <DraftRunConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={onConfirm}
        briefName={briefName}
      />
    </>
  );
}
